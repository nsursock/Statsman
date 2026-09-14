import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStats, getStatsRange } from '$lib/server/db';
import { isCloud, aiConfigured } from '$lib/server/config';
import { DEMO_SITE_NAME } from '$lib/server/demo';
import { detectInsights, buildContext, explain } from '$lib/server/ai/analyst';

const DAY_MS = 24 * 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => ({}))) as {
		siteId?: string;
		days?: number;
	};
	const siteId = body.siteId;
	const days = Math.min(Math.max(Number(body.days ?? 7) || 7, 1), 90);

	if (!siteId) error(400, 'siteId is required');
	const site = await getSite(siteId);
	if (!site) error(404, 'Unknown site');

	// Allow public access to the demo site; authenticate everything else.
	const isDemo = site.name === DEMO_SITE_NAME;
	if (!isDemo) {
		if (isCloud()) {
			if (!locals.user) error(401, 'Login required');
			if (!site.user_id || site.user_id !== locals.user.id) error(403, 'Forbidden');
		} else if (!locals.adminOk) {
			error(401, 'Admin required');
		}
	}

	const now = Date.now();
	const currentStart = now - days * DAY_MS;
	const prevStart = now - days * 2 * DAY_MS;

	const [current, previous] = await Promise.all([
		getStats(site.id, days),
		getStatsRange(site.id, prevStart, currentStart)
	]);

	const insights = detectInsights(current, previous);
	const context = buildContext(site, days, current, previous, insights);
	const result = await explain(context);

	return json({
		...result,
		aiAvailable: aiConfigured()
	});
};
