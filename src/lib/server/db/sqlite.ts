import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { getDatabasePath } from '$lib/server/config';
import { aggregatePathMeta } from '$lib/server/path-meta';
import {
	bucketMsForSpan,
	bucketMsForTarget,
	clampPoints,
	DEFAULT_POINTS,
	fillTimeseries,
	fillTimeseriesRange
} from '$lib/timeseries';
import type {
	EventInput,
	RecentEvent,
	Session,
	Site,
	SiteTrackingPatch,
	StatsSummary,
	Store,
	User
} from './types';
import { serializeExcludedIps } from '$lib/server/exclusions';

function mapSite(row: Record<string, unknown> | undefined): Site | undefined {
	if (!row) return undefined;
	return {
		id: String(row.id),
		user_id: (row.user_id as string | null) ?? null,
		name: String(row.name),
		domain: String(row.domain),
		created_at: Number(row.created_at),
		excluded_ips: typeof row.excluded_ips === 'string' ? row.excluded_ips : '[]',
		ignore_localhost: row.ignore_localhost === 0 || row.ignore_localhost === false ? false : true
	};
}

function openSqlite(): Database.Database {
	const path = resolve(getDatabasePath());
	mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	migrate(db);
	return db;
}

function migrate(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			plan TEXT NOT NULL DEFAULT 'free',
			stripe_customer_id TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at INTEGER NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS login_tokens (
			token_hash TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS sites (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			domain TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id TEXT NOT NULL,
			name TEXT NOT NULL DEFAULT 'pageview',
			path TEXT NOT NULL,
			referrer TEXT,
			title TEXT,
			lang TEXT,
			screen TEXT,
			browser TEXT,
			os TEXT,
			device TEXT,
			country TEXT,
			city TEXT,
			lat REAL,
			lng REAL,
			duration_ms INTEGER,
			props TEXT,
			visitor_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS usage_monthly (
			user_id TEXT NOT NULL,
			yyyymm TEXT NOT NULL,
			pageviews INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, yyyymm),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);
	`);

	const siteCols = db.prepare(`PRAGMA table_info(sites)`).all() as { name: string }[];
	if (!siteCols.some((c) => c.name === 'user_id')) {
		db.exec(`ALTER TABLE sites ADD COLUMN user_id TEXT`);
	}
	if (!siteCols.some((c) => c.name === 'excluded_ips')) {
		db.exec(`ALTER TABLE sites ADD COLUMN excluded_ips TEXT NOT NULL DEFAULT '[]'`);
	}
	if (!siteCols.some((c) => c.name === 'ignore_localhost')) {
		db.exec(`ALTER TABLE sites ADD COLUMN ignore_localhost INTEGER NOT NULL DEFAULT 1`);
	}

	const eventCols = new Set(
		(db.prepare(`PRAGMA table_info(events)`).all() as { name: string }[]).map((c) => c.name)
	);
	for (const col of [
		'title',
		'lang',
		'screen',
		'country',
		'city',
		'lat',
		'lng',
		'duration_ms',
		'props'
	] as const) {
		if (!eventCols.has(col)) {
			const typ = col === 'lat' || col === 'lng' || col === 'duration_ms' ? 'REAL' : 'TEXT';
			// duration_ms stored as INTEGER conceptually; REAL is fine in SQLite affinity
			db.exec(
				`ALTER TABLE events ADD COLUMN ${col} ${col === 'duration_ms' ? 'INTEGER' : typ}`
			);
		}
	}

	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_events_site_created ON events(site_id, created_at);
		CREATE INDEX IF NOT EXISTS idx_events_site_path ON events(site_id, path);
		CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
		CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);
	`);

	const siteCount = db.prepare('SELECT COUNT(*) AS c FROM sites').get() as { c: number };
	if (siteCount.c === 0) {
		const id = randomBytes(8).toString('hex');
		db.prepare(
			`INSERT INTO sites (id, user_id, name, domain, created_at, excluded_ips, ignore_localhost)
			 VALUES (?, NULL, ?, ?, ?, '[]', 0)`
		).run(id, 'Demo Site', 'localhost', Date.now());
	} else {
		db.prepare(
			`UPDATE sites SET ignore_localhost = 0 WHERE name = ? AND ignore_localhost != 0`
		).run('Demo Site');
	}
}

function buildStats(
	db: Database.Database,
	siteId: string,
	days: number,
	points = DEFAULT_POINTS,
	endMs?: number,
	sinceMs?: number
): StatsSummary {
	const end = endMs ?? Date.now();
	const since = sinceMs ?? (end - days * 24 * 60 * 60 * 1000);
	const targetPoints = clampPoints(points);

	const totals = db
		.prepare(
			`SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor_hash) AS visitors
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'`
		)
		.get(siteId, since, end) as { pageviews: number; visitors: number };

	const visitPages = db
		.prepare(
			`SELECT visitor_hash, COUNT(*) AS pages
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY visitor_hash`
		)
		.all(siteId, since, end) as { visitor_hash: string; pages: number }[];

	const singlePageVisits = visitPages.filter((v) => v.pages === 1).length;
	const bounceRate =
		visitPages.length === 0 ? 0 : Math.round((singlePageVisits / visitPages.length) * 100);
	const avgPagesPerVisit =
		visitPages.length === 0
			? 0
			: Math.round((visitPages.reduce((sum, v) => sum + v.pages, 0) / visitPages.length) * 10) /
				10;

	const pathRows = db
		.prepare(
			`SELECT path, COUNT(*) AS views FROM events
			 WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY path`
		)
		.all(siteId, since, end) as { path: string; views: number }[];
	const { topPages, campaigns, utmSources, utmMediums } = aggregatePathMeta(pathRows, 10);

	const topReferrers = db
		.prepare(
			`SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS referrer, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY referrer ORDER BY views DESC LIMIT 10`
		)
		.all(siteId, since, end) as { referrer: string; views: number }[];

	const browsers = db
		.prepare(
			`SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY browser ORDER BY views DESC LIMIT 8`
		)
		.all(siteId, since, end) as { browser: string; views: number }[];

	const operatingSystems = db
		.prepare(
			`SELECT COALESCE(os, 'Unknown') AS os, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY os ORDER BY views DESC LIMIT 8`
		)
		.all(siteId, since, end) as { os: string; views: number }[];

	const devices = db
		.prepare(
			`SELECT COALESCE(device, 'Unknown') AS device, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY device ORDER BY views DESC LIMIT 8`
		)
		.all(siteId, since, end) as { device: string; views: number }[];

	const languages = db
		.prepare(
			`SELECT COALESCE(NULLIF(lang, ''), 'Unknown') AS label, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY lang ORDER BY views DESC LIMIT 8`
		)
		.all(siteId, since, end) as { label: string; views: number }[];

	const screens = db
		.prepare(
			`SELECT COALESCE(NULLIF(screen, ''), 'Unknown') AS label, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY screen ORDER BY views DESC LIMIT 8`
		)
		.all(siteId, since, end) as { label: string; views: number }[];

	const countries = db
		.prepare(
			`SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS label, COUNT(*) AS views
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY country ORDER BY views DESC LIMIT 12`
		)
		.all(siteId, since, end) as { label: string; views: number }[];

	const cities = db
		.prepare(
			`SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS city,
				COALESCE(NULLIF(country, ''), '?') AS country,
				AVG(lat) AS lat, AVG(lng) AS lng, COUNT(*) AS views
			 FROM events
			 WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
				AND lat IS NOT NULL AND lng IS NOT NULL
			 GROUP BY city, country ORDER BY views DESC LIMIT 40`
		)
		.all(siteId, since, end) as {
		city: string;
		country: string;
		lat: number;
		lng: number;
		views: number;
	}[];

	const customEvents = db
		.prepare(
			`SELECT name AS label, COUNT(*) AS views FROM events
			 WHERE site_id = ? AND created_at >= ? AND created_at < ?
				AND name NOT IN ('pageview', 'engagement')
			 GROUP BY name ORDER BY views DESC LIMIT 12`
		)
		.all(siteId, since, end) as { label: string; views: number }[];

	const durationRows = db
		.prepare(
			`SELECT visitor_hash, MAX(duration_ms) AS duration_ms FROM events
			 WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'engagement' AND duration_ms IS NOT NULL
			 GROUP BY visitor_hash`
		)
		.all(siteId, since, end) as { visitor_hash: string; duration_ms: number }[];
	const avgVisitDurationSec =
		durationRows.length === 0
			? 0
			: Math.round(
					durationRows.reduce((s, r) => s + Number(r.duration_ms), 0) /
						durationRows.length /
						1000
				);

	const span = end - since;
	const bucketMs = sinceMs != null ? bucketMsForSpan(span, targetPoints) : bucketMsForTarget(days, targetPoints);
	const rawSeries = db
		.prepare(
			`SELECT (created_at - (created_at % ?)) AS bucket,
				COUNT(*) AS pageviews, COUNT(DISTINCT visitor_hash) AS visitors
			 FROM events WHERE site_id = ? AND created_at >= ? AND created_at < ? AND name = 'pageview'
			 GROUP BY bucket ORDER BY bucket ASC`
		)
		.all(bucketMs, siteId, since, end) as {
		bucket: number;
		pageviews: number;
		visitors: number;
	}[];

	const timeseries =
		sinceMs != null
			? fillTimeseriesRange(since, end, rawSeries, targetPoints)
			: fillTimeseries(days, rawSeries, targetPoints);

	return {
		pageviews: totals.pageviews,
		visitors: totals.visitors,
		bounceRate,
		avgPagesPerVisit,
		avgVisitDurationSec,
		topPages,
		topReferrers,
		browsers,
		operatingSystems,
		devices,
		languages,
		screens,
		utmSources,
		utmMediums,
		campaigns,
		countries,
		cities: cities.map((c) => ({
			city: c.city,
			country: c.country,
			lat: Number(c.lat),
			lng: Number(c.lng),
			views: Number(c.views)
		})),
		customEvents,
		timeseries
	};
}

export function createSqliteStore(): Store {
	const db = openSqlite();

	return {
		async listSites(userId) {
			if (userId) {
				return (
					db
						.prepare('SELECT * FROM sites WHERE user_id = ? ORDER BY created_at DESC')
						.all(userId) as Record<string, unknown>[]
				)
					.map((r) => mapSite(r)!)
					.filter(Boolean);
			}
			return (db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all() as Record<
				string,
				unknown
			>[])
				.map((r) => mapSite(r)!)
				.filter(Boolean);
		},

		async getSite(id) {
			return mapSite(
				db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as Record<string, unknown> | undefined
			);
		},

		async createSite(name, domain, userId = null, opts) {
			const id = randomBytes(8).toString('hex');
			const created_at = Date.now();
			const ignoreLocalhost = opts?.ignoreLocalhost === false ? 0 : 1;
			db.prepare(
				`INSERT INTO sites (id, user_id, name, domain, created_at, excluded_ips, ignore_localhost)
				 VALUES (?, ?, ?, ?, ?, '[]', ?)`
			).run(id, userId, name, domain, created_at, ignoreLocalhost);
			return {
				id,
				user_id: userId,
				name,
				domain,
				created_at,
				excluded_ips: '[]',
				ignore_localhost: ignoreLocalhost === 1
			};
		},

		async updateSiteTracking(id, patch: SiteTrackingPatch) {
			const current = await this.getSite(id);
			if (!current) return undefined;
			const excluded =
				patch.excluded_ips !== undefined
					? serializeExcludedIps(patch.excluded_ips)
					: current.excluded_ips;
			const ignore =
				patch.ignore_localhost !== undefined
					? patch.ignore_localhost
						? 1
						: 0
					: current.ignore_localhost
						? 1
						: 0;
			db.prepare(
				`UPDATE sites SET excluded_ips = ?, ignore_localhost = ? WHERE id = ?`
			).run(excluded, ignore, id);
			return this.getSite(id);
		},

		async deleteSite(id) {
			const result = db.prepare('DELETE FROM sites WHERE id = ?').run(id);
			return result.changes > 0;
		},

		async countSitesForUser(userId) {
			const row = db
				.prepare('SELECT COUNT(*) AS c FROM sites WHERE user_id = ?')
				.get(userId) as { c: number };
			return row.c;
		},

		async insertEvent(event: EventInput) {
			db.prepare(
				`INSERT INTO events (
					site_id, name, path, referrer, title, lang, screen, browser, os, device,
					country, city, lat, lng, duration_ms, props, visitor_hash, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).run(
				event.siteId,
				event.name ?? 'pageview',
				event.path,
				event.referrer ?? null,
				event.title ?? null,
				event.lang ?? null,
				event.screen ?? null,
				event.browser ?? null,
				event.os ?? null,
				event.device ?? null,
				event.country ?? null,
				event.city ?? null,
				event.lat ?? null,
				event.lng ?? null,
				event.durationMs ?? null,
				event.props ?? null,
				event.visitorHash,
				event.createdAt ?? Date.now()
			);
		},

		async insertEvents(events: EventInput[]) {
			if (!events.length) return;
			const stmt = db.prepare(
				`INSERT INTO events (
					site_id, name, path, referrer, title, lang, screen, browser, os, device,
					country, city, lat, lng, duration_ms, props, visitor_hash, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			);
			const insertMany = db.transaction((rows: EventInput[]) => {
				for (const event of rows) {
					stmt.run(
						event.siteId,
						event.name ?? 'pageview',
						event.path,
						event.referrer ?? null,
						event.title ?? null,
						event.lang ?? null,
						event.screen ?? null,
						event.browser ?? null,
						event.os ?? null,
						event.device ?? null,
						event.country ?? null,
						event.city ?? null,
						event.lat ?? null,
						event.lng ?? null,
						event.durationMs ?? null,
						event.props ?? null,
						event.visitorHash,
						event.createdAt ?? Date.now()
					);
				}
			});
			insertMany(events);
		},

		async clearSiteEvents(siteId: string) {
			db.prepare('DELETE FROM events WHERE site_id = ?').run(siteId);
		},

		async getStats(siteId, days = 7, points = DEFAULT_POINTS) {
			return buildStats(db, siteId, days, points);
		},

		async getStatsRange(siteId, startMs, endMs, points = DEFAULT_POINTS) {
			const days = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));
			return buildStats(db, siteId, days, points, endMs, startMs);
		},

		async getRecentEvents(siteId, limit = 12) {
			return db
				.prepare(
					`SELECT id, name, path, referrer, title, browser, os, device, country, city, created_at
					 FROM events
					 WHERE site_id = ? AND name != 'engagement'
					 ORDER BY id DESC LIMIT ?`
				)
				.all(siteId, limit) as RecentEvent[];
		},

		async siteHasEvents(siteId) {
			const row = db
				.prepare('SELECT 1 AS ok FROM events WHERE site_id = ? LIMIT 1')
				.get(siteId) as { ok: number } | undefined;
			return Boolean(row);
		},

		async getUserById(id) {
			return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
		},

		async getUserByEmail(email) {
			return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
		},

		async upsertUserByEmail(email) {
			const existing = await this.getUserByEmail(email);
			if (existing) return existing;
			const id = randomBytes(8).toString('hex');
			const created_at = Date.now();
			const { isFounderEmail } = await import('$lib/server/config');
			const plan = isFounderEmail(email) ? 'founder' : 'free';
			db.prepare(
				'INSERT INTO users (id, email, plan, stripe_customer_id, created_at) VALUES (?, ?, ?, NULL, ?)'
			).run(id, email, plan, created_at);
			return {
				id,
				email,
				plan,
				stripe_customer_id: null,
				created_at
			};
		},

		async setUserPlan(userId, plan) {
			db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);
		},

		async setStripeCustomerId(userId, customerId) {
			db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(
				customerId,
				userId
			);
		},

		async getUserByStripeCustomer(customerId) {
			return db
				.prepare('SELECT * FROM users WHERE stripe_customer_id = ?')
				.get(customerId) as User | undefined;
		},

		async createLoginToken(userId, tokenHash, expiresAt) {
			db.prepare(
				'INSERT OR REPLACE INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
			).run(tokenHash, userId, expiresAt);
		},

		async consumeLoginToken(tokenHash) {
			const row = db
				.prepare('SELECT user_id, expires_at FROM login_tokens WHERE token_hash = ?')
				.get(tokenHash) as { user_id: string; expires_at: number } | undefined;
			if (!row) return undefined;
			db.prepare('DELETE FROM login_tokens WHERE token_hash = ?').run(tokenHash);
			if (row.expires_at < Date.now()) return undefined;
			return row.user_id;
		},

		async createSession(userId, tokenHash, expiresAt) {
			const id = randomBytes(8).toString('hex');
			db.prepare(
				'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
			).run(id, userId, tokenHash, expiresAt);
		},

		async getSessionUser(tokenHash) {
			const row = db
				.prepare(
					`SELECT u.* FROM sessions s
					 JOIN users u ON u.id = s.user_id
					 WHERE s.token_hash = ? AND s.expires_at > ?`
				)
				.get(tokenHash, Date.now()) as User | undefined;
			return row;
		},

		async deleteSession(tokenHash) {
			db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
		},

		async getMonthlyUsage(userId, yyyymm) {
			const row = db
				.prepare('SELECT pageviews FROM usage_monthly WHERE user_id = ? AND yyyymm = ?')
				.get(userId, yyyymm) as { pageviews: number } | undefined;
			return row?.pageviews ?? 0;
		},

		async incrementMonthlyUsage(userId, yyyymm, by = 1) {
			db.prepare(
				`INSERT INTO usage_monthly (user_id, yyyymm, pageviews) VALUES (?, ?, ?)
				 ON CONFLICT(user_id, yyyymm) DO UPDATE SET pageviews = pageviews + excluded.pageviews`
			).run(userId, yyyymm, by);
			return this.getMonthlyUsage(userId, yyyymm);
		}
	};
}

// silence unused Session type import in some TS configs
export type { Session };
