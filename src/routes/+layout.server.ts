import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';
import {
	isStatsmanConsolePath,
	statsmanConsoleIgnoreAttr
} from '$lib/console-paths';

/** Optional dogfood / first-client tracker injection via public env. */
export const load: LayoutServerLoad = ({ url }) => {
	const siteId = (env.PUBLIC_ANALYTICS_SITE_ID ?? '').trim();
	if (!siteId) return { analytics: null };

	// Don't even load the tracker on console routes (SPA ignore still needed from marketing).
	if (isStatsmanConsolePath(url.pathname)) {
		return { analytics: null };
	}

	const origin = (env.PUBLIC_ANALYTICS_ORIGIN ?? '').trim().replace(/\/$/, '');
	const publicOrigin = (env.PUBLIC_ORIGIN ?? '').trim().replace(/\/$/, '');
	let allowLocalhost = false;
	try {
		const host = new URL(origin || publicOrigin || 'http://localhost').hostname;
		allowLocalhost =
			host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
	} catch {
		allowLocalhost = true;
	}

	return {
		analytics: {
			siteId,
			src: origin ? `${origin}/tracker.js` : '/tracker.js',
			allowLocalhost,
			ignorePrefixes: statsmanConsoleIgnoreAttr()
		}
	};
};
