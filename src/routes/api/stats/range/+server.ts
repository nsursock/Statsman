import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStatsRange } from '$lib/server/db';
import { isCloud } from '$lib/server/config';

/**
 * Stats for an explicit [startMs, endMs) window — used by the dashboard
 * drill-down (click a bar to see only that bucket's stats).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const siteId = url.searchParams.get('siteId');
	const startMs = Number(url.searchParams.get('startMs'));
	const endMs = Number(url.searchParams.get('endMs'));
	const points = Number(url.searchParams.get('points')) || undefined;

	const site = siteId ? await getSite(siteId) : undefined;
	if (!site) error(404, 'Unknown site');
	if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
		error(400, 'Invalid range');
	}

	if (isCloud()) {
		if (!locals.user) error(401, 'Login required');
		if (!site.user_id || site.user_id !== locals.user.id) error(403, 'Forbidden');
	} else if (!locals.adminOk) {
		error(401, 'Admin required');
	}

	return json({
		stats: await getStatsRange(site.id, startMs, endMs, points)
	});
};
