import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getPublicOrigin } from './config';
import { createSite, getStats, getStore, listSites } from './db';
import type { Site } from './db';

export const DEMO_SITE_NAME = 'Demo Site';

function flag(raw: string | undefined): boolean | undefined {
	const v = (raw ?? '').trim().toLowerCase();
	if (['0', 'false', 'off', 'no'].includes(v)) return false;
	if (['1', 'true', 'on', 'yes'].includes(v)) return true;
	return undefined;
}

/**
 * Demo lab (fake blog at /demo + landing page dogfooding).
 * Default: on in `vite dev`, off in prod. Force with STATSMAN_DEMO=1/0.
 */
export function demoEnabled(): boolean {
	return flag(env.STATSMAN_DEMO) ?? dev;
}

/**
 * Backfill the demo site with ~30 days of synthetic traffic so the dashboard
 * looks alive on first boot. Guarded — only seeds when the site is quiet.
 * Default: dev only. Force with STATSMAN_DEMO_SEED=1/0.
 */
export function demoSeedEnabled(): boolean {
	return flag(env.STATSMAN_DEMO_SEED) ?? dev;
}

function demoHost(): string {
	try {
		return new URL(getPublicOrigin()).hostname;
	} catch {
		return 'localhost';
	}
}

/** Find the demo site, creating it on first run. Returns undefined when disabled. */
export async function getDemoSite(): Promise<Site | undefined> {
	if (!demoEnabled()) return undefined;
	const sites = await listSites();
	const existing = sites.find((s) => s.name === DEMO_SITE_NAME);
	if (existing) return existing;
	return createSite(DEMO_SITE_NAME, demoHost());
}

/* ---------------- synthetic traffic ---------------- */

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(rnd: () => number, weighted: [T, number][]): T {
	const total = weighted.reduce((s, [, w]) => s + w, 0);
	let roll = rnd() * total;
	for (const [v, w] of weighted) {
		roll -= w;
		if (roll <= 0) return v;
	}
	return weighted[0][0];
}

const PATHS: [string, number][] = [
	['/posts/goodbye-google-analytics', 18],
	['/posts/sqlite-forever?utm_source=hn&utm_medium=social&utm_campaign=launch', 12],
	['/', 14],
	['/posts/eleventy-on-fly-io?utm_source=newsletter&utm_medium=email&utm_campaign=week04', 9],
	['/posts/the-204-tactic', 9],
	['/about', 8],
	['/posts/ship-log-04?ref=mastodon', 7],
	['/uses', 5],
	['/posts/cookie-banner-free?utm_source=twitter&utm_medium=social&utm_campaign=thread', 5],
	['/posts/indie-infra-zero-budget', 3]
];

const REFS: [string | null, number][] = [
	['news.ycombinator.com', 24],
	['google.com', 20],
	[null, 20],
	['mastodon.social', 11],
	['lobste.rs', 9],
	['til.blog', 7],
	['reddit.com', 5],
	['bsky.app', 4]
];

const BROWSERS: [string, number][] = [
	['Chrome', 44],
	['Safari', 26],
	['Firefox', 15],
	['Edge', 6],
	['Opera', 5],
	['Other', 4]
];

const OS: [string, number][] = [
	['macOS', 34],
	['Windows', 28],
	['iOS', 18],
	['Android', 14],
	['Linux', 6]
];

const DEVICES: [string, number][] = [
	['Desktop', 58],
	['Mobile', 36],
	['Tablet', 6]
];

const LANGS: [string, number][] = [
	['en-US', 48],
	['en-GB', 14],
	['de-DE', 10],
	['fr-FR', 9],
	['ja-JP', 7],
	['es-ES', 6],
	['pt-BR', 6]
];

const SCREENS: [string, number][] = [
	['1920x1080', 28],
	['1512x982', 16],
	['390x844', 18],
	['1440x900', 12],
	['2560x1440', 10],
	['414x896', 9],
	['1366x768', 7]
];

const TITLES: Record<string, string> = {
	'/': 'Demo Blog',
	'/about': 'About · Demo Blog',
	'/uses': 'Uses · Demo Blog',
	'/posts/goodbye-google-analytics': 'Goodbye Google Analytics',
	'/posts/sqlite-forever': 'SQLite Forever',
	'/posts/eleventy-on-fly-io': 'Eleventy on Fly.io',
	'/posts/the-204-tactic': 'The 204 Tactic',
	'/posts/ship-log-04': 'Ship Log 04',
	'/posts/cookie-banner-free': 'Cookie-Banner Free',
	'/posts/indie-infra-zero-budget': 'Indie Infra, Zero Budget'
};

/** Weighted city pins for the visitor globe (demo only). */
const GEO: [{ country: string; city: string; lat: number; lng: number }, number][] = [
	[{ country: 'US', city: 'San Francisco', lat: 37.77, lng: -122.42 }, 22],
	[{ country: 'US', city: 'New York', lat: 40.71, lng: -74.01 }, 18],
	[{ country: 'DE', city: 'Berlin', lat: 52.52, lng: 13.41 }, 14],
	[{ country: 'GB', city: 'London', lat: 51.51, lng: -0.13 }, 14],
	[{ country: 'FR', city: 'Paris', lat: 48.86, lng: 2.35 }, 10],
	[{ country: 'JP', city: 'Tokyo', lat: 35.68, lng: 139.69 }, 12],
	[{ country: 'BR', city: 'São Paulo', lat: -23.55, lng: -46.63 }, 8],
	[{ country: 'IN', city: 'Bengaluru', lat: 12.97, lng: 77.59 }, 9],
	[{ country: 'AU', city: 'Sydney', lat: -33.87, lng: 151.21 }, 7],
	[{ country: 'CA', city: 'Toronto', lat: 43.65, lng: -79.38 }, 8],
	[{ country: 'NL', city: 'Amsterdam', lat: 52.37, lng: 4.9 }, 6],
	[{ country: 'SE', city: 'Stockholm', lat: 59.33, lng: 18.07 }, 5],
	[{ country: 'SG', city: 'Singapore', lat: 1.35, lng: 103.82 }, 6],
	[{ country: 'KR', city: 'Seoul', lat: 37.57, lng: 126.98 }, 5]
];

	const CUSTOM_EVENTS: [string, number][] = [
		['outbound_link', 18],
		['download', 12],
		['scroll_75', 10],
		['engaged_visit', 9],
		['newsletter_subscribe', 8],
		['signup', 6],
		['route_change', 5]
	];

/**
 * Insert ~1.6k plausible pageviews across the last 30 days — weekly rhythm,
 * one HN spike, session-like bursts (1–4 pages per visitor). No-op when the
 * demo site already has traffic, so restarts never double-seed.
 */
export async function seedDemoTraffic(siteId: string): Promise<{ seeded: number }> {
	const stats = await getStats(siteId, 30);
	if (stats.pageviews >= 800) {
		if ((stats.cities?.length ?? 0) === 0) await seedDemoGeoOverlay(siteId);
		return { seeded: 0 };
	}

	const rnd = mulberry32(0x5eed);
	const store = await getStore();
	const visitors = Array.from({ length: 240 }, (_, i) => `demo-visitor-${i}`);
	const dayMs = 24 * 60 * 60 * 1000;
	const spikeDay = 11; // days ago — the front-page-of-HN day

	let seeded = 0;
	for (let ago = 29; ago >= 0; ago--) {
		const weekday = new Date(Date.now() - ago * dayMs).getUTCDay();
		const weekendDip = weekday === 0 || weekday === 6 ? 0.55 : 1;
		const growth = 1 + (29 - ago) * 0.02;
		let todays = Math.round((34 + rnd() * 30) * weekendDip * growth);
		if (ago === spikeDay) todays *= 4;

		const dayStart = Date.now() - ago * dayMs - 20 * 60 * 60 * 1000;
		let inserted = 0;
		while (inserted < todays) {
			const visitor = visitors[Math.floor(rnd() * visitors.length)];
			const sessionPages = 1 + Math.floor(rnd() * rnd() * 4); // skew toward 1
			const sessionStart = dayStart + rnd() * 20 * 60 * 60 * 1000;
			const ref = pick(rnd, REFS);
			const browser = pick(rnd, BROWSERS);
			const os = pick(rnd, OS);
			const device = pick(rnd, DEVICES);
			const lang = pick(rnd, LANGS);
			const screen = pick(rnd, SCREENS);
			const geo = pick(rnd, GEO);
			for (let p = 0; p < sessionPages && inserted < todays; p++) {
				const path = pick(rnd, PATHS);
				const pathname = path.split('?')[0] || '/';
				const createdAt = Math.round(sessionStart + p * (40_000 + rnd() * 240_000));
				await store.insertEvent({
					siteId,
					name: 'pageview',
					path,
					referrer: p === 0 ? ref : 'localhost',
					title: TITLES[pathname] ?? pathname,
					lang,
					screen,
					browser,
					device,
					os,
					country: geo.country,
					city: geo.city,
					lat: geo.lat,
					lng: geo.lng,
					visitorHash: visitor,
					createdAt
				});
				inserted++;
				seeded++;
			}
			// Engagement heartbeat for the session
			await store.insertEvent({
				siteId,
				name: 'engagement',
				path: '/',
				durationMs: Math.round(8_000 + rnd() * 180_000),
				country: geo.country,
				city: geo.city,
				lat: geo.lat,
				lng: geo.lng,
				browser,
				os,
				device,
				visitorHash: visitor,
				createdAt: Math.round(sessionStart + sessionPages * 60_000)
			});
			if (rnd() < 0.12) {
				await store.insertEvent({
					siteId,
					name: pick(rnd, CUSTOM_EVENTS),
					path: pick(rnd, PATHS).split('?')[0],
					props: JSON.stringify({ demo: true }),
					country: geo.country,
					city: geo.city,
					lat: geo.lat,
					lng: geo.lng,
					browser,
					os,
					device,
					visitorHash: visitor,
					createdAt: Math.round(sessionStart + rnd() * 90_000)
				});
			}
		}
	}
	return { seeded };
}

/** Backfill globe + custom events onto an already-seeded demo DB (idempotent-ish). */
async function seedDemoGeoOverlay(siteId: string): Promise<void> {
	const rnd = mulberry32(0x6e07);
	const store = await getStore();
	const now = Date.now();
	for (let i = 0; i < 220; i++) {
		const geo = pick(rnd, GEO);
		const path = pick(rnd, PATHS);
		const visitor = `demo-geo-${i % 80}`;
		const createdAt = now - Math.round(rnd() * 14 * 24 * 60 * 60 * 1000);
		await store.insertEvent({
			siteId,
			name: 'pageview',
			path,
			title: TITLES[path.split('?')[0]] ?? path,
			country: geo.country,
			city: geo.city,
			lat: geo.lat,
			lng: geo.lng,
			browser: pick(rnd, BROWSERS),
			os: pick(rnd, OS),
			device: pick(rnd, DEVICES),
			lang: pick(rnd, LANGS),
			screen: pick(rnd, SCREENS),
			visitorHash: visitor,
			createdAt
		});
		if (rnd() < 0.35) {
			await store.insertEvent({
				siteId,
				name: 'engagement',
				path: path.split('?')[0],
				durationMs: Math.round(10_000 + rnd() * 120_000),
				country: geo.country,
				city: geo.city,
				lat: geo.lat,
				lng: geo.lng,
				visitorHash: visitor,
				createdAt: createdAt + 30_000
			});
		}
		if (rnd() < 0.2) {
			await store.insertEvent({
				siteId,
				name: pick(rnd, CUSTOM_EVENTS),
				path: path.split('?')[0],
				country: geo.country,
				city: geo.city,
				lat: geo.lat,
				lng: geo.lng,
				visitorHash: visitor,
				createdAt: createdAt + 15_000
			});
		}
	}
}
