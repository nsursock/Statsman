import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { demoSeedEnabled, getDemoSite, seedDemoTraffic } from '$lib/server/demo';
import { isCloud, showMarketing } from '$lib/server/config';

export const load: PageServerLoad = async ({ locals }) => {
	// Pure self-host installs are an app, not a marketing site.
	if (!showMarketing()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}

	const demo = await getDemoSite();
	if (demo && demoSeedEnabled()) await seedDemoTraffic(demo.id);
	const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
	return {
		demo: demo ? { id: demo.id, name: demo.name, domain: demo.domain } : null,
		authed
	};
};
