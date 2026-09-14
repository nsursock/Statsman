import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { billingEnabled } from '$lib/server/stripe';
import { isCloud, showMarketing } from '$lib/server/config';
import { getDemoSite } from '$lib/server/demo';
import { COMPETITORS } from '$lib/comparisons';

export const load: PageServerLoad = async ({ locals }) => {
	if (!showMarketing()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}

	const demo = await getDemoSite();

	return {
		competitors: COMPETITORS.map((c) => ({
			slug: c.slug,
			name: c.name,
			tagline: c.tagline,
			startingPrice: c.startingPrice,
			statsmanWins: c.statsmanWins[0]
		})),
		demoAvailable: Boolean(demo),
		billingEnabled: billingEnabled()
	};
};
