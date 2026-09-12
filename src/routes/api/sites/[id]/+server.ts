import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStore } from '$lib/server/db';
import { isCloud } from '$lib/server/config';
import { normalizeIp, parseExcludedIps } from '$lib/server/exclusions';

async function assertCanManageSite(siteId: string, locals: App.Locals) {
	const site = await getSite(siteId);
	if (!site) error(404, 'Site not found');

	if (isCloud()) {
		if (!locals.user) error(401, 'Login required');
		if (site.user_id !== locals.user.id) error(403, 'Not your site');
	} else if (!locals.adminOk) {
		error(401, 'Admin required');
	}

	return site;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const site = await assertCanManageSite(params.id, locals);
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

	const patch: { excluded_ips?: string[]; ignore_localhost?: boolean } = {};

	if ('ignore_localhost' in body) {
		patch.ignore_localhost = Boolean(body.ignore_localhost);
	}

	if ('excluded_ips' in body) {
		const raw = body.excluded_ips;
		if (!Array.isArray(raw)) error(400, 'excluded_ips must be an array');
		const ips = raw
			.map((v) => normalizeIp(String(v)))
			.filter((v): v is string => Boolean(v));
		if (ips.length > 50) error(400, 'At most 50 excluded IPs');
		for (const ip of ips) {
			if (ip.length > 45) error(400, 'Invalid IP address');
		}
		patch.excluded_ips = ips;
	}

	if (!('excluded_ips' in patch) && !('ignore_localhost' in patch)) {
		error(400, 'No tracking settings to update');
	}

	const store = await getStore();
	const updated = await store.updateSiteTracking(site.id, patch);
	if (!updated) error(404, 'Site not found');

	return json({
		site: {
			...updated,
			excluded_ips: parseExcludedIps(updated.excluded_ips)
		}
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const site = await assertCanManageSite(params.id, locals);

	const store = await getStore();
	const ok = await store.deleteSite(site.id);
	if (!ok) error(404, 'Site not found');

	return json({ ok: true, id: site.id });
};
