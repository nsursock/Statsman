import postgres from 'postgres';
import { randomBytes } from 'node:crypto';
import { getPostgresConfig } from '$lib/server/config';
import { aggregatePathMeta } from '$lib/server/path-meta';
import { bucketMsForTarget, clampPoints, DEFAULT_POINTS, fillTimeseries } from '$lib/timeseries';
import type { EventInput, RecentEvent, Site, StatsSummary, Store, User } from './types';

function sql() {
	const cfg = getPostgresConfig();
	if (!cfg) {
		throw new Error(
			'Postgres not configured: set DATABASE_URL or PGHOST+PGUSER+PGPASSWORD (+ PGDATABASE/PGPORT)'
		);
	}
	const local =
		cfg.kind === 'url'
			? /@(localhost|127\.0\.0\.1)(:|\/)/i.test(cfg.url)
			: /^(localhost|127\.0\.0\.1)$/i.test(cfg.host);
	const opts = {
		max: 10,
		ssl: local ? (false as const) : ('require' as const),
		connect_timeout: 15
	};
	if (cfg.kind === 'url') return postgres(cfg.url, opts);
	return postgres({
		host: cfg.host,
		port: cfg.port,
		database: cfg.database,
		username: cfg.user,
		password: cfg.password,
		...opts
	});
}

async function migrate(db: postgres.Sql) {
	await db`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			plan TEXT NOT NULL DEFAULT 'free',
			stripe_customer_id TEXT,
			created_at BIGINT NOT NULL
		)`;
	await db`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at BIGINT NOT NULL
		)`;
	await db`
		CREATE TABLE IF NOT EXISTS login_tokens (
			token_hash TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at BIGINT NOT NULL
		)`;
	await db`
		CREATE TABLE IF NOT EXISTS sites (
			id TEXT PRIMARY KEY,
			user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			domain TEXT NOT NULL,
			created_at BIGINT NOT NULL
		)`;
	await db`
		CREATE TABLE IF NOT EXISTS events (
			id BIGSERIAL PRIMARY KEY,
			site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
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
			lat DOUBLE PRECISION,
			lng DOUBLE PRECISION,
			duration_ms INTEGER,
			props TEXT,
			visitor_hash TEXT NOT NULL,
			created_at BIGINT NOT NULL
		)`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS lang TEXT`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS screen TEXT`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS city TEXT`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_ms INTEGER`;
	await db`ALTER TABLE events ADD COLUMN IF NOT EXISTS props TEXT`;
	await db`
		CREATE TABLE IF NOT EXISTS usage_monthly (
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			yyyymm TEXT NOT NULL,
			pageviews INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, yyyymm)
		)`;
	await db`CREATE INDEX IF NOT EXISTS idx_events_site_created ON events(site_id, created_at)`;
	await db`CREATE INDEX IF NOT EXISTS idx_events_site_path ON events(site_id, path)`;
	await db`CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id)`;

	const [{ c }] = await db`SELECT COUNT(*)::int AS c FROM sites`;
	if (c === 0) {
		const id = randomBytes(8).toString('hex');
		await db`
			INSERT INTO sites (id, user_id, name, domain, created_at)
			VALUES (${id}, NULL, ${'Demo Site'}, ${'localhost'}, ${Date.now()})`;
	}
}

async function buildStats(
	db: postgres.Sql,
	siteId: string,
	days: number,
	points = DEFAULT_POINTS
): Promise<StatsSummary> {
	const since = Date.now() - days * 24 * 60 * 60 * 1000;
	const targetPoints = clampPoints(points);

	const [totals] = await db`
		SELECT COUNT(*)::int AS pageviews, COUNT(DISTINCT visitor_hash)::int AS visitors
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'`;

	const visitPages = await db`
		SELECT visitor_hash, COUNT(*)::int AS pages
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY visitor_hash`;

	const singlePageVisits = visitPages.filter((v) => v.pages === 1).length;
	const bounceRate =
		visitPages.length === 0 ? 0 : Math.round((singlePageVisits / visitPages.length) * 100);
	const avgPagesPerVisit =
		visitPages.length === 0
			? 0
			: Math.round(
					(visitPages.reduce((sum, v) => sum + Number(v.pages), 0) / visitPages.length) * 10
				) / 10;

	const pathRows = await db`
		SELECT path, COUNT(*)::int AS views FROM events
		WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY path`;
	const { topPages, campaigns, utmSources, utmMediums } = aggregatePathMeta(
		pathRows.map((r) => ({ path: r.path as string, views: Number(r.views) })),
		10
	);

	const topReferrers = await db`
		SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS referrer, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY referrer ORDER BY views DESC LIMIT 10`;

	const browsers = await db`
		SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY browser ORDER BY views DESC LIMIT 8`;

	const operatingSystems = await db`
		SELECT COALESCE(os, 'Unknown') AS os, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY os ORDER BY views DESC LIMIT 8`;

	const devices = await db`
		SELECT COALESCE(device, 'Unknown') AS device, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY device ORDER BY views DESC LIMIT 8`;

	const languages = await db`
		SELECT COALESCE(NULLIF(lang, ''), 'Unknown') AS label, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY lang ORDER BY views DESC LIMIT 8`;

	const screens = await db`
		SELECT COALESCE(NULLIF(screen, ''), 'Unknown') AS label, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY screen ORDER BY views DESC LIMIT 8`;

	const countries = await db`
		SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS label, COUNT(*)::int AS views
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY country ORDER BY views DESC LIMIT 12`;

	const cities = await db`
		SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS city,
			COALESCE(NULLIF(country, ''), '?') AS country,
			AVG(lat) AS lat, AVG(lng) AS lng, COUNT(*)::int AS views
		FROM events
		WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
			AND lat IS NOT NULL AND lng IS NOT NULL
		GROUP BY city, country ORDER BY views DESC LIMIT 40`;

	const customEvents = await db`
		SELECT name AS label, COUNT(*)::int AS views FROM events
		WHERE site_id = ${siteId} AND created_at >= ${since}
			AND name NOT IN ('pageview', 'engagement')
		GROUP BY name ORDER BY views DESC LIMIT 12`;

	const durationRows = await db`
		SELECT visitor_hash, MAX(duration_ms)::int AS duration_ms FROM events
		WHERE site_id = ${siteId} AND created_at >= ${since}
			AND name = 'engagement' AND duration_ms IS NOT NULL
		GROUP BY visitor_hash`;
	const avgVisitDurationSec =
		durationRows.length === 0
			? 0
			: Math.round(
					durationRows.reduce((s, r) => s + Number(r.duration_ms), 0) /
						durationRows.length /
						1000
				);

	const bucketMs = bucketMsForTarget(days, targetPoints);
	const rawSeries = await db`
		SELECT (created_at - (created_at % ${bucketMs}::bigint)) AS bucket,
			COUNT(*)::int AS pageviews, COUNT(DISTINCT visitor_hash)::int AS visitors
		FROM events WHERE site_id = ${siteId} AND created_at >= ${since} AND name = 'pageview'
		GROUP BY 1 ORDER BY 1 ASC`;

	const timeseries = fillTimeseries(
		days,
		rawSeries.map((r) => ({
			bucket: r.bucket as number | string | bigint,
			pageviews: r.pageviews as number | string,
			visitors: r.visitors as number | string
		})),
		targetPoints
	);

	return {
		pageviews: Number(totals.pageviews),
		visitors: Number(totals.visitors),
		bounceRate,
		avgPagesPerVisit,
		avgVisitDurationSec,
		topPages,
		topReferrers: topReferrers.map((r) => ({
			referrer: r.referrer as string,
			views: Number(r.views)
		})),
		browsers: browsers.map((r) => ({ browser: r.browser as string, views: Number(r.views) })),
		operatingSystems: operatingSystems.map((r) => ({
			os: r.os as string,
			views: Number(r.views)
		})),
		devices: devices.map((r) => ({ device: r.device as string, views: Number(r.views) })),
		languages: languages.map((r) => ({ label: r.label as string, views: Number(r.views) })),
		screens: screens.map((r) => ({ label: r.label as string, views: Number(r.views) })),
		utmSources,
		utmMediums,
		campaigns,
		countries: countries.map((r) => ({ label: r.label as string, views: Number(r.views) })),
		cities: cities.map((r) => ({
			city: r.city as string,
			country: r.country as string,
			lat: Number(r.lat),
			lng: Number(r.lng),
			views: Number(r.views)
		})),
		customEvents: customEvents.map((r) => ({
			label: r.label as string,
			views: Number(r.views)
		})),
		timeseries
	};
}

export async function createPostgresStore(): Promise<Store> {
	const db = sql();
	await migrate(db);

	const store: Store = {
		async listSites(userId) {
			const rows = userId
				? await db`SELECT * FROM sites WHERE user_id = ${userId} ORDER BY created_at DESC`
				: await db`SELECT * FROM sites ORDER BY created_at DESC`;
			return rows as unknown as Site[];
		},

		async getSite(id) {
			const [row] = await db`SELECT * FROM sites WHERE id = ${id}`;
			return row as Site | undefined;
		},

		async createSite(name, domain, userId = null) {
			const id = randomBytes(8).toString('hex');
			const created_at = Date.now();
			await db`
				INSERT INTO sites (id, user_id, name, domain, created_at)
				VALUES (${id}, ${userId}, ${name}, ${domain}, ${created_at})`;
			return { id, user_id: userId, name, domain, created_at };
		},

		async deleteSite(id) {
			const result = await db`DELETE FROM sites WHERE id = ${id}`;
			return result.count > 0;
		},

		async countSitesForUser(userId) {
			const [row] = await db`SELECT COUNT(*)::int AS c FROM sites WHERE user_id = ${userId}`;
			return Number(row.c);
		},

		async insertEvent(event: EventInput) {
			await db`
				INSERT INTO events (
					site_id, name, path, referrer, title, lang, screen, browser, os, device,
					country, city, lat, lng, duration_ms, props, visitor_hash, created_at
				)
				VALUES (
					${event.siteId},
					${event.name ?? 'pageview'},
					${event.path},
					${event.referrer ?? null},
					${event.title ?? null},
					${event.lang ?? null},
					${event.screen ?? null},
					${event.browser ?? null},
					${event.os ?? null},
					${event.device ?? null},
					${event.country ?? null},
					${event.city ?? null},
					${event.lat ?? null},
					${event.lng ?? null},
					${event.durationMs ?? null},
					${event.props ?? null},
					${event.visitorHash},
					${event.createdAt ?? Date.now()}
				)`;
		},

		async getStats(siteId, days = 7, points = DEFAULT_POINTS) {
			return buildStats(db, siteId, days, points);
		},

		async getRecentEvents(siteId, limit = 12) {
			const rows = await db`
				SELECT id, name, path, referrer, title, browser, os, device, country, city, created_at
				FROM events
				WHERE site_id = ${siteId} AND name != 'engagement'
				ORDER BY id DESC LIMIT ${limit}`;
			return rows.map(
				(r): RecentEvent => ({
					id: Number(r.id),
					name: (r.name as string) ?? 'pageview',
					path: r.path as string,
					referrer: r.referrer as string | null,
					title: (r.title as string | null) ?? null,
					browser: r.browser as string | null,
					os: (r.os as string | null) ?? null,
					device: r.device as string | null,
					country: (r.country as string | null) ?? null,
					city: (r.city as string | null) ?? null,
					created_at: Number(r.created_at)
				})
			);
		},

		async siteHasEvents(siteId) {
			const [row] = await db`SELECT 1 AS ok FROM events WHERE site_id = ${siteId} LIMIT 1`;
			return Boolean(row);
		},

		async getUserById(id) {
			const [row] = await db`SELECT * FROM users WHERE id = ${id}`;
			return row as User | undefined;
		},

		async getUserByEmail(email) {
			const [row] = await db`SELECT * FROM users WHERE email = ${email}`;
			return row as User | undefined;
		},

		async upsertUserByEmail(email) {
			const existing = await store.getUserByEmail(email);
			if (existing) return existing;
			const id = randomBytes(8).toString('hex');
			const created_at = Date.now();
			await db`
				INSERT INTO users (id, email, plan, stripe_customer_id, created_at)
				VALUES (${id}, ${email}, ${'free'}, NULL, ${created_at})`;
			return { id, email, plan: 'free', stripe_customer_id: null, created_at };
		},

		async setUserPlan(userId, plan) {
			await db`UPDATE users SET plan = ${plan} WHERE id = ${userId}`;
		},

		async setStripeCustomerId(userId, customerId) {
			await db`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}`;
		},

		async getUserByStripeCustomer(customerId) {
			const [row] = await db`SELECT * FROM users WHERE stripe_customer_id = ${customerId}`;
			return row as User | undefined;
		},

		async createLoginToken(userId, tokenHash, expiresAt) {
			await db`
				INSERT INTO login_tokens (token_hash, user_id, expires_at)
				VALUES (${tokenHash}, ${userId}, ${expiresAt})
				ON CONFLICT (token_hash) DO UPDATE SET user_id = ${userId}, expires_at = ${expiresAt}`;
		},

		async consumeLoginToken(tokenHash) {
			const [row] =
				await db`SELECT user_id, expires_at FROM login_tokens WHERE token_hash = ${tokenHash}`;
			if (!row) return undefined;
			await db`DELETE FROM login_tokens WHERE token_hash = ${tokenHash}`;
			if (Number(row.expires_at) < Date.now()) return undefined;
			return row.user_id as string;
		},

		async createSession(userId, tokenHash, expiresAt) {
			const id = randomBytes(8).toString('hex');
			await db`
				INSERT INTO sessions (id, user_id, token_hash, expires_at)
				VALUES (${id}, ${userId}, ${tokenHash}, ${expiresAt})`;
		},

		async getSessionUser(tokenHash) {
			const [row] = await db`
				SELECT u.* FROM sessions s
				JOIN users u ON u.id = s.user_id
				WHERE s.token_hash = ${tokenHash} AND s.expires_at > ${Date.now()}`;
			return row as User | undefined;
		},

		async deleteSession(tokenHash) {
			await db`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
		},

		async getMonthlyUsage(userId, yyyymm) {
			const [row] =
				await db`SELECT pageviews FROM usage_monthly WHERE user_id = ${userId} AND yyyymm = ${yyyymm}`;
			return row ? Number(row.pageviews) : 0;
		},

		async incrementMonthlyUsage(userId, yyyymm, by = 1) {
			await db`
				INSERT INTO usage_monthly (user_id, yyyymm, pageviews)
				VALUES (${userId}, ${yyyymm}, ${by})
				ON CONFLICT (user_id, yyyymm)
				DO UPDATE SET pageviews = usage_monthly.pageviews + ${by}`;
			return store.getMonthlyUsage(userId, yyyymm);
		}
	};

	return store;
}
