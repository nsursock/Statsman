import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSite, getStore, listSites } from '$lib/server/db';
import { isCloud } from '$lib/server/config';
import { effectiveCloudLimits } from '$lib/server/plans';
import { normalizeHost } from '$lib/server/domain';
import { DEMO_SITE_NAME } from '$lib/server/demo';
import { operatorSites } from '$lib/server/onboarding';

export const GET: RequestHandler = async ({ locals }) => {
	if (isCloud()) {
		if (!locals.user) error(401, 'Login required');
		return json({ sites: operatorSites(await listSites(locals.user.id)) });
	}
	if (!locals.adminOk) error(401, 'Admin required');
	return json({ sites: operatorSites(await listSites()) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	const name = String(body.name ?? '').trim();
	const domainRaw = String(body.domain ?? '').trim();
	const domain = normalizeHost(domainRaw) ?? domainRaw;
	if (!name || !domain) {
		error(400, 'name and domain are required');
	}
	if (name === DEMO_SITE_NAME) {
		error(400, 'That name is reserved for the public demo lab');
	}

	if (isCloud()) {
		if (!locals.user) error(401, 'Login required');
		const store = await getStore();
		const limits = effectiveCloudLimits(locals.user.plan);
		const count = await store.countSitesForUser(locals.user.id);
		if (count >= limits.sites) {
			error(402, limits.sites === 0 ? 'No active subscription. Subscribe to a plan to create sites.' : `Plan allows ${limits.sites} site(s). Upgrade to add more.`);
		}
		const site = await createSite(name, domain, locals.user.id);
		return json({ site }, { status: 201 });
	}

	if (!locals.adminOk) error(401, 'Admin required');
	const site = await createSite(name, domain, null);
	return json({ site }, { status: 201 });
};
