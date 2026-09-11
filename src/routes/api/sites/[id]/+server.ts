import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStore } from '$lib/server/db';
import { isCloud } from '$lib/server/config';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const site = await getSite(params.id);
	if (!site) error(404, 'Site not found');

	if (isCloud()) {
		if (!locals.user) error(401, 'Login required');
		if (site.user_id !== locals.user.id) error(403, 'Not your site');
	} else if (!locals.adminOk) {
		error(401, 'Admin required');
	}

	const store = await getStore();
	const ok = await store.deleteSite(site.id);
	if (!ok) error(404, 'Site not found');

	return json({ ok: true, id: site.id });
};
