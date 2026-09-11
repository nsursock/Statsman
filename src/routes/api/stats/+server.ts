import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStats } from '$lib/server/db';
import { isCloud } from '$lib/server/config';

export const GET: RequestHandler = async ({ url, locals }) => {
	const siteId = url.searchParams.get('siteId');
	const days = Number(url.searchParams.get('days') ?? 7);
	const site = siteId ? await getSite(siteId) : undefined;
	if (!site) error(404, 'Unknown site');

	if (isCloud()) {
		if (!locals.user) error(401, 'Login required');
		if (site.user_id && site.user_id !== locals.user.id) error(403, 'Forbidden');
	} else if (!locals.adminOk) {
		error(401, 'Admin required');
	}

	return json({
		site,
		stats: await getStats(
			site.id,
			Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 7
		)
	});
};
