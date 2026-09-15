import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getPublicOrigin } from './config';
import { clearSiteEvents, createSite, getStats, getStore, insertEvents, listSites } from './db';
import type { EventInput, Site } from './db';
import { demoPosts, DEMO_BLOG_NAME } from '$lib/demo-posts';

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
	return createSite(DEMO_SITE_NAME, demoHost(), null, { ignoreLocalhost: false });
}

/* ---------------- statistical modeling & synthetic traffic ---------------- */

export function createRng(seed: number) {
	let a = (seed >>> 0) || 0x5eed;

	function next(): number {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	function uniform(min: number, max: number): number {
		return min + next() * (max - min);
	}

	function int(min: number, max: number): number {
		return Math.floor(uniform(min, max + 1));
	}

	let hasSpare = false;
	let spare = 0;
	function normal(mean = 0, std = 1): number {
		if (hasSpare) {
			hasSpare = false;
			return mean + spare * std;
		}
		let u = 0;
		let v = 0;
		while (u === 0) u = next();
		while (v === 0) v = next();
		const mag = Math.sqrt(-2.0 * Math.log(u));
		spare = mag * Math.sin(2.0 * Math.PI * v);
		hasSpare = true;
		return mean + mag * Math.cos(2.0 * Math.PI * v) * std;
	}

	function logNormal(mu: number, sigma: number): number {
		return Math.exp(normal(mu, sigma));
	}

	function gamma(shape: number, scale = 1): number {
		if (shape < 1) {
			return gamma(shape + 1, scale) * Math.pow(Math.max(1e-12, next()), 1 / shape);
		}
		const d = shape - 1 / 3;
		const c = 1 / Math.sqrt(9 * d);
		while (true) {
			let z = 0;
			let v = 0;
			do {
				z = normal(0, 1);
				v = 1 + c * z;
			} while (v <= 0);
			v = v * v * v;
			const u = next();
			if (u < 1 - 0.0331 * z * z * z * z) return d * v * scale;
			if (Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) return d * v * scale;
		}
	}

	function poisson(lambda: number): number {
		if (lambda <= 0) return 0;
		if (lambda < 30) {
			const L = Math.exp(-lambda);
			let k = 0;
			let p = 1;
			do {
				k++;
				p *= next();
			} while (p > L);
			return k - 1;
		}
		return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda))));
	}

	function choice<T>(list: readonly T[]): T {
		return list[Math.floor(next() * list.length)];
	}

	function weightedChoice<T>(weighted: readonly [T, number][]): T {
		const total = weighted.reduce((s, [, w]) => s + w, 0);
		let roll = next() * total;
		for (const [v, w] of weighted) {
			roll -= w;
			if (roll <= 0) return v;
		}
		return weighted[0][0];
	}

	return {
		next,
		uniform,
		int,
		normal,
		logNormal,
		gamma,
		poisson,
		choice,
		weightedChoice
	};
}

const LOCAL_HOURLY_WEIGHTS: number[] = [
	0.8, 0.5, 0.3, 0.2, 0.2, 0.4, 1.2, 2.5, 4.2, 6.0,
	7.2, 7.8, 7.5, 7.4, 7.1, 6.6, 5.8, 5.2, 5.6, 6.4,
	6.2, 4.8, 3.2, 1.8
];

type GeoLocation = {
	country: string;
	city: string;
	lat: number;
	lng: number;
	utcOffset: number;
	weight: number;
	languages: [string, number][];
};

const GEO_LOCATIONS: GeoLocation[] = [
	{
		country: 'US',
		city: 'San Francisco',
		lat: 37.77,
		lng: -122.42,
		utcOffset: -8,
		weight: 24,
		languages: [['en-US', 96], ['es-US', 4]]
	},
	{
		country: 'US',
		city: 'New York',
		lat: 40.71,
		lng: -74.01,
		utcOffset: -5,
		weight: 18,
		languages: [['en-US', 94], ['es-US', 6]]
	},
	{
		country: 'US',
		city: 'Seattle',
		lat: 47.61,
		lng: -122.33,
		utcOffset: -8,
		weight: 12,
		languages: [['en-US', 96], ['en-GB', 4]]
	},
	{
		country: 'US',
		city: 'Austin',
		lat: 30.27,
		lng: -97.74,
		utcOffset: -6,
		weight: 9,
		languages: [['en-US', 95], ['es-US', 5]]
	},
	{
		country: 'GB',
		city: 'London',
		lat: 51.51,
		lng: -0.13,
		utcOffset: 0,
		weight: 16,
		languages: [['en-GB', 92], ['en-US', 8]]
	},
	{
		country: 'DE',
		city: 'Berlin',
		lat: 52.52,
		lng: 13.41,
		utcOffset: 1,
		weight: 14,
		languages: [['de-DE', 84], ['en-US', 16]]
	},
	{
		country: 'DE',
		city: 'Munich',
		lat: 48.14,
		lng: 11.58,
		utcOffset: 1,
		weight: 6,
		languages: [['de-DE', 86], ['en-US', 14]]
	},
	{
		country: 'FR',
		city: 'Paris',
		lat: 48.86,
		lng: 2.35,
		utcOffset: 1,
		weight: 11,
		languages: [['fr-FR', 86], ['en-US', 14]]
	},
	{
		country: 'CA',
		city: 'Toronto',
		lat: 43.65,
		lng: -79.38,
		utcOffset: -5,
		weight: 8,
		languages: [['en-CA', 82], ['fr-CA', 12], ['en-US', 6]]
	},
	{
		country: 'NL',
		city: 'Amsterdam',
		lat: 52.37,
		lng: 4.9,
		utcOffset: 1,
		weight: 8,
		languages: [['nl-NL', 68], ['en-US', 32]]
	},
	{
		country: 'SE',
		city: 'Stockholm',
		lat: 59.33,
		lng: 18.07,
		utcOffset: 1,
		weight: 6,
		languages: [['sv-SE', 68], ['en-US', 32]]
	},
	{
		country: 'JP',
		city: 'Tokyo',
		lat: 35.68,
		lng: 139.69,
		utcOffset: 9,
		weight: 12,
		languages: [['ja-JP', 92], ['en-US', 8]]
	},
	{
		country: 'AU',
		city: 'Sydney',
		lat: -33.87,
		lng: 151.21,
		utcOffset: 10,
		weight: 7,
		languages: [['en-AU', 90], ['en-US', 10]]
	},
	{
		country: 'IN',
		city: 'Bengaluru',
		lat: 12.97,
		lng: 77.59,
		utcOffset: 5.5,
		weight: 9,
		languages: [['en-IN', 65], ['en-US', 35]]
	},
	{
		country: 'BR',
		city: 'São Paulo',
		lat: -23.55,
		lng: -46.63,
		utcOffset: -3,
		weight: 7,
		languages: [['pt-BR', 88], ['en-US', 12]]
	},
	{
		country: 'SG',
		city: 'Singapore',
		lat: 1.35,
		lng: 103.82,
		utcOffset: 8,
		weight: 5,
		languages: [['en-SG', 72], ['en-US', 28]]
	},
	{
		country: 'KR',
		city: 'Seoul',
		lat: 37.57,
		lng: 126.98,
		utcOffset: 9,
		weight: 5,
		languages: [['ko-KR', 92], ['en-US', 8]]
	},
	{
		country: 'CH',
		city: 'Zurich',
		lat: 47.37,
		lng: 8.54,
		utcOffset: 1,
		weight: 4,
		languages: [['de-CH', 60], ['en-US', 26], ['fr-CH', 14]]
	}
];

type ClientEnvironment = {
	device: 'Desktop' | 'Mobile' | 'Tablet';
	os: string;
	browser: string;
	screen: string;
};

function sampleClientEnvironment(
	rng: ReturnType<typeof createRng>,
	isTechHeavy: boolean
): ClientEnvironment {
	const desktopWeight = isTechHeavy ? 70 : 60;
	const mobileWeight = isTechHeavy ? 26 : 36;
	const tabletWeight = 4;

	const device = rng.weightedChoice< 'Desktop' | 'Mobile' | 'Tablet' >([
		['Desktop', desktopWeight],
		['Mobile', mobileWeight],
		['Tablet', tabletWeight]
	]);

	if (device === 'Desktop') {
		const os = rng.weightedChoice<string>([
			['macOS', isTechHeavy ? 50 : 45],
			['Windows', isTechHeavy ? 32 : 41],
			['Linux', isTechHeavy ? 18 : 14]
		]);

		if (os === 'macOS') {
			const browser = rng.weightedChoice<string>([
				['Chrome', 52],
				['Safari', 32],
				['Firefox', 12],
				['Edge', 4]
			]);
			const screen = rng.weightedChoice<string>([
				['1512x982', 32],
				['1440x900', 26],
				['1728x1117', 16],
				['2560x1440', 16],
				['1920x1080', 10]
			]);
			return { device, os, browser, screen };
		} else if (os === 'Windows') {
			const browser = rng.weightedChoice<string>([
				['Chrome', 64],
				['Edge', 24],
				['Firefox', 10],
				['Opera', 2]
			]);
			const screen = rng.weightedChoice<string>([
				['1920x1080', 66],
				['2560x1440', 20],
				['1366x768', 9],
				['3840x2160', 5]
			]);
			return { device, os, browser, screen };
		} else {
			const browser = rng.weightedChoice<string>([
				['Firefox', 58],
				['Chrome', 37],
				['Other', 5]
			]);
			const screen = rng.weightedChoice<string>([
				['1920x1080', 68],
				['2560x1440', 24],
				['3840x2160', 8]
			]);
			return { device, os, browser, screen };
		}
	} else if (device === 'Mobile') {
		const os = rng.weightedChoice<string>([
			['iOS', 62],
			['Android', 38]
		]);
		if (os === 'iOS') {
			const browser = rng.weightedChoice<string>([
				['Safari', 84],
				['Chrome', 14],
				['Firefox', 2]
			]);
			const screen = rng.weightedChoice<string>([
				['393x852', 36],
				['390x844', 34],
				['414x896', 18],
				['375x667', 12]
			]);
			return { device, os, browser, screen };
		} else {
			const browser = rng.weightedChoice<string>([
				['Chrome', 86],
				['Opera', 9],
				['Firefox', 5]
			]);
			const screen = rng.weightedChoice<string>([
				['412x915', 45],
				['390x844', 25],
				['360x800', 20],
				['414x896', 10]
			]);
			return { device, os, browser, screen };
		}
	} else {
		const os = rng.weightedChoice<string>([
			['iOS', 84],
			['Android', 16]
		]);
		const browser = os === 'iOS' ? 'Safari' : 'Chrome';
		const screen = rng.weightedChoice<string>([
			['820x1180', 44],
			['834x1194', 36],
			['1024x1366', 20]
		]);
		return { device, os, browser, screen };
	}
}

const TITLES: Record<string, string> = {
	'/': DEMO_BLOG_NAME,
	'/about': `About · ${DEMO_BLOG_NAME}`,
	'/uses': `Uses · ${DEMO_BLOG_NAME}`,
	...Object.fromEntries(demoPosts.map((p) => [`/posts/${p.slug}`, p.title]))
};

export function generateRealisticDemoEvents(
	siteId: string,
	seed: number
): { events: EventInput[]; summary: { totalEvents: number; pageviews: number } } {
	const rng = createRng(seed);
	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;
	const events: EventInput[] = [];

	const postSlugs = demoPosts.map((p) => p.slug);
	const primaryPost = `/posts/${postSlugs[0] ?? 'sqlite-forever'}`;
	const viralPostSlug = rng.weightedChoice<string>([
		['sqlite-forever', 45],
		['goodbye-google-analytics', 35],
		['the-204-tactic', 15],
		['cookie-banner-free', 5]
	]);
	const viralPath = `/posts/${viralPostSlug}`;

	const viralReferrer = rng.weightedChoice<string>([
		['news.ycombinator.com', 75],
		['lobste.rs', 15],
		['reddit.com', 10]
	]);

	const spikeDayAgo = rng.int(8, 17);
	const newsletterDayAgo = Math.max(1, (spikeDayAgo + rng.int(4, 7)) % 27);

	const visitorsPool = Array.from(
		{ length: 1400 },
		(_, i) => `demo-v-${rng.int(100000, 999999).toString(36)}-${i}`
	);

	let visitorCursor = 0;
	function getVisitor(allowRepeat: boolean): string {
		if (allowRepeat && visitorCursor > 20 && rng.next() < 0.22) {
			return visitorsPool[rng.int(0, Math.min(visitorCursor - 1, 350))];
		}
		const v = visitorsPool[visitorCursor % visitorsPool.length];
		visitorCursor++;
		return v;
	}

	for (let ago = 29; ago >= 0; ago--) {
		const dayDate = new Date(now - ago * dayMs);
		const dayStart = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate())).getTime();
		const weekday = dayDate.getUTCDay();

		const weekdayMultipliers = [0.62, 1.08, 1.25, 1.22, 1.12, 0.88, 0.52];
		const weekdayFactor = weekdayMultipliers[weekday] ?? 1.0;
		const trendFactor = 1.0 + (29 - ago) * rng.uniform(0.008, 0.015);

		let spikeMultiplier = 1.0;
		if (ago === spikeDayAgo) {
			spikeMultiplier = rng.uniform(3.8, 5.2);
		} else if (ago === spikeDayAgo - 1) {
			spikeMultiplier = rng.uniform(1.6, 2.2);
		} else if (ago === spikeDayAgo - 2) {
			spikeMultiplier = rng.uniform(1.15, 1.35);
		} else if (ago === newsletterDayAgo) {
			spikeMultiplier = rng.uniform(1.4, 1.7);
		}

		const baseRate = 38 * weekdayFactor * trendFactor * spikeMultiplier;
		const dailyShock = rng.gamma(14, 1 / 14);
		const targetSessions = Math.max(12, rng.poisson(baseRate * dailyShock));

		for (let s = 0; s < targetSessions; s++) {
			const isSpikeSession = ago === spikeDayAgo || (ago === spikeDayAgo - 1 && rng.next() < 0.5);
			const isNewsletterSession = ago === newsletterDayAgo && rng.next() < 0.35;

			const geo = rng.weightedChoice<GeoLocation>(
				GEO_LOCATIONS.map((g) => [g, g.weight])
			);

			const lat = Math.round((geo.lat + rng.normal(0, 0.03)) * 100) / 100;
			const lng = Math.round((geo.lng + rng.normal(0, 0.03)) * 100) / 100;
			const lang = rng.weightedChoice<string>(geo.languages);

			const localHour = rng.weightedChoice<number>(
				LOCAL_HOURLY_WEIGHTS.map((w, h) => [h, w])
			);
			const utcHour = (localHour - Math.floor(geo.utcOffset) + 24) % 24;
			const minute = rng.int(0, 59);
			const second = rng.int(0, 59);
			const sessionStart = dayStart + (utcHour * 3600 + minute * 60 + second) * 1000;

			if (sessionStart > now) continue;

			const visitor = getVisitor(true);
			const envClient = sampleClientEnvironment(rng, isSpikeSession);

			let referrer: string | null = null;
			let landingPath: string = '/';

			if (isSpikeSession) {
				referrer = viralReferrer;
				landingPath = rng.next() < 0.3
					? `${viralPath}?utm_source=hn&utm_medium=social&utm_campaign=launch`
					: viralPath;
			} else if (isNewsletterSession) {
				referrer = rng.next() < 0.15 ? 'mail.google.com' : null;
				const featured = rng.choice(postSlugs);
				landingPath = `/posts/${featured}?utm_source=newsletter&utm_medium=email&utm_campaign=week${String(Math.max(1, 30 - ago)).padStart(2, '0')}`;
			} else {
				const channel = rng.weightedChoice<'search' | 'social' | 'direct' | 'community'>([
					['search', 28],
					['social', 22],
					['community', 24],
					['direct', 26]
				]);

				if (channel === 'search') {
					referrer = rng.weightedChoice<string>([
						['google.com', 82],
						['duckduckgo.com', 14],
						['ecosia.org', 4]
					]);
					landingPath = rng.weightedChoice<string>([
						[primaryPost, 28],
						[`/posts/${rng.choice(postSlugs)}`, 44],
						['/', 28]
					]);
				} else if (channel === 'social') {
					const ref = rng.weightedChoice<string>([
						['mastodon.social', 40],
						['bsky.app', 30],
						['reddit.com', 30]
					]);
					referrer = ref;
					landingPath = rng.next() < 0.2
						? `/posts/${rng.choice(postSlugs)}?utm_source=${ref.split('.')[0]}&utm_medium=social&utm_campaign=thread`
						: `/posts/${rng.choice(postSlugs)}`;
				} else if (channel === 'community') {
					referrer = rng.weightedChoice<string>([
						['news.ycombinator.com', 55],
						['lobste.rs', 30],
						['til.blog', 15]
					]);
					landingPath = `/posts/${rng.choice(postSlugs)}`;
				} else {
					referrer = null;
					landingPath = rng.weightedChoice<string>([
						['/', 50],
						['/about', 18],
						['/uses', 14],
						[`/posts/${rng.choice(postSlugs)}`, 18]
					]);
				}
			}

			const bounceProb = isSpikeSession ? 0.65 : isNewsletterSession ? 0.44 : 0.55;
			const isBounce = rng.next() < bounceProb;
			const sessionPagesCount = isBounce ? 1 : 1 + Math.min(3, rng.poisson(1.1) + 1);

			let currentPath = landingPath;
			let currentTimestamp = sessionStart;

			for (let p = 0; p < sessionPagesCount; p++) {
				const cleanPath = currentPath.split('?')[0] || '/';
				const title = TITLES[cleanPath] ?? cleanPath;
				const pageReferrer = p === 0 ? referrer : 'localhost';

				events.push({
					siteId,
					name: 'pageview',
					path: currentPath,
					referrer: pageReferrer,
					title,
					lang,
					screen: envClient.screen,
					browser: envClient.browser,
					device: envClient.device,
					os: envClient.os,
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					visitorHash: visitor,
					createdAt: currentTimestamp
				});

				if (p < sessionPagesCount - 1) {
					events.push({
						siteId,
						name: 'route_change',
						path: cleanPath,
						props: JSON.stringify({ to: cleanPath }),
						country: geo.country,
						city: geo.city,
						lat,
						lng,
						browser: envClient.browser,
						os: envClient.os,
						device: envClient.device,
						visitorHash: visitor,
						createdAt: currentTimestamp + 500
					});

					const dwellSec = rng.logNormal(3.7, 0.5);
					currentTimestamp += Math.round(dwellSec * 1000);

					if (cleanPath.startsWith('/posts/')) {
						currentPath = rng.weightedChoice<string>([
							['/', 45],
							[`/posts/${rng.choice(postSlugs)}`, 35],
							['/about', 12],
							['/uses', 8]
						]);
					} else if (cleanPath === '/') {
						currentPath = rng.weightedChoice<string>([
							[`/posts/${rng.choice(postSlugs)}`, 70],
							['/about', 18],
							['/uses', 12]
						]);
					} else {
						currentPath = rng.weightedChoice<string>([
							['/', 60],
							[`/posts/${rng.choice(postSlugs)}`, 40]
						]);
					}
				}
			}

			const totalDurationSec = isBounce
				? rng.logNormal(2.4, 0.6)
				: rng.logNormal(4.7, 0.5);
			const durationMs = Math.round(Math.max(3000, totalDurationSec * 1000));

			events.push({
				siteId,
				name: 'engagement',
				path: landingPath.split('?')[0] || '/',
				durationMs,
				country: geo.country,
				city: geo.city,
				lat,
				lng,
				browser: envClient.browser,
				os: envClient.os,
				device: envClient.device,
				visitorHash: visitor,
				createdAt: Math.min(now, currentTimestamp + Math.min(durationMs, 180000))
			});

			const landingClean = landingPath.split('?')[0] || '/';
			if (totalDurationSec > 35 && landingClean.startsWith('/posts/')) {
				if (rng.next() < 0.72) {
					events.push({
						siteId,
						name: 'scroll_75',
						path: landingClean,
						props: JSON.stringify({ demo: true }),
						country: geo.country,
						city: geo.city,
						lat,
						lng,
						browser: envClient.browser,
						os: envClient.os,
						device: envClient.device,
						visitorHash: visitor,
						createdAt: currentTimestamp + 25000
					});
				}
			}

			if (totalDurationSec > 60) {
				events.push({
					siteId,
					name: 'engaged_visit',
					path: landingClean,
					props: JSON.stringify({ durationSec: Math.round(totalDurationSec) }),
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					browser: envClient.browser,
					os: envClient.os,
					device: envClient.device,
					visitorHash: visitor,
					createdAt: currentTimestamp + 60000
				});
			}

			if (landingClean === '/uses' && rng.next() < 0.28) {
				events.push({
					siteId,
					name: 'outbound_link',
					path: landingClean,
					props: JSON.stringify({ href: 'https://github.com/statsman' }),
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					browser: envClient.browser,
					os: envClient.os,
					device: envClient.device,
					visitorHash: visitor,
					createdAt: currentTimestamp + rng.int(10000, 30000)
				});
			} else if (landingClean.startsWith('/posts/') && rng.next() < 0.12) {
				events.push({
					siteId,
					name: 'outbound_link',
					path: landingClean,
					props: JSON.stringify({ href: 'https://sqlite.org' }),
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					browser: envClient.browser,
					os: envClient.os,
					device: envClient.device,
					visitorHash: visitor,
					createdAt: currentTimestamp + rng.int(15000, 45000)
				});
			}

			if (totalDurationSec > 60 && rng.next() < 0.032) {
				events.push({
					siteId,
					name: 'newsletter_subscribe',
					path: landingClean,
					props: JSON.stringify({ source: 'footer_form' }),
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					browser: envClient.browser,
					os: envClient.os,
					device: envClient.device,
					visitorHash: visitor,
					createdAt: currentTimestamp + rng.int(35000, 75000)
				});
			}

			if (landingClean === '/posts/sqlite-forever' && rng.next() < 0.08) {
				events.push({
					siteId,
					name: 'download',
					path: landingClean,
					props: JSON.stringify({ file: 'statsman-schema.sql' }),
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					browser: envClient.browser,
					os: envClient.os,
					device: envClient.device,
					visitorHash: visitor,
					createdAt: currentTimestamp + rng.int(20000, 50000)
				});
			}

			if (totalDurationSec > 75 && rng.next() < 0.015) {
				events.push({
					siteId,
					name: 'signup',
					path: landingClean,
					props: JSON.stringify({ plan: 'free' }),
					country: geo.country,
					city: geo.city,
					lat,
					lng,
					browser: envClient.browser,
					os: envClient.os,
					device: envClient.device,
					visitorHash: visitor,
					createdAt: currentTimestamp + rng.int(45000, 90000)
				});
			}
		}
	}

	events.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
	const pageviews = events.filter((e) => e.name === 'pageview').length;

	return {
		events,
		summary: {
			totalEvents: events.length,
			pageviews
		}
	};
}

let currentDemoSeed: number | null = null;

/**
 * Seed demo traffic for the demo site.
 * When force is true (default for demo console visits), existing demo events are cleared
 * and a freshly randomized realistic dataset is inserted.
 */
export async function seedDemoTraffic(
	siteId: string,
	options?: { force?: boolean; seed?: number }
): Promise<{ seeded: number; seed: number }> {
	const force = options?.force ?? false;
	const stats = await getStats(siteId, 30);

	if (!force && stats.pageviews >= 800) {
		return { seeded: 0, seed: options?.seed ?? currentDemoSeed ?? 0 };
	}

	const seed = options?.seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
	currentDemoSeed = seed;
	const { events } = generateRealisticDemoEvents(siteId, seed);

	await clearSiteEvents(siteId);
	await insertEvents(events);

	return { seeded: events.length, seed };
}
