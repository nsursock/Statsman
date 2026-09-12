import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';

/** Optional dogfood / first-client tracker injection via public env. */
export const load: LayoutServerLoad = () => {
	const siteId = (env.PUBLIC_ANALYTICS_SITE_ID ?? '').trim();
	if (!siteId) return { analytics: null };

	const origin = (env.PUBLIC_ANALYTICS_ORIGIN ?? '').trim().replace(/\/$/, '');
	return {
		analytics: {
			siteId,
			src: origin ? `${origin}/tracker.js` : '/tracker.js'
		}
	};
};
