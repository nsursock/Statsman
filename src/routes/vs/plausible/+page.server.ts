import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { billingEnabled } from '$lib/server/stripe';
import { isCloud, showMarketing } from '$lib/server/config';
import { getDemoSite } from '$lib/server/demo';
import { getCompetitor } from '$lib/comparisons';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!showMarketing()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}

	const competitor = getCompetitor('plausible');
	if (!competitor) error(404, 'Comparison not found');

	const demo = await getDemoSite();

	return {
		competitor,
		demoAvailable: Boolean(demo),
		billingEnabled: billingEnabled()
	};
};
