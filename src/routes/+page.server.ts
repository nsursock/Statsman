import type { PageServerLoad } from './$types';
import { demoSeedEnabled, getDemoSite, seedDemoTraffic } from '$lib/server/demo';
import { isCloud } from '$lib/server/config';

export const load: PageServerLoad = async ({ locals }) => {
	const demo = await getDemoSite();
	if (demo && demoSeedEnabled()) await seedDemoTraffic(demo.id);
	const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
	return {
		demo: demo ? { id: demo.id, name: demo.name, domain: demo.domain } : null,
		authed
	};
};
