import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getStripeConfig, isCloud } from '$lib/server/config';
import { billingEnabled } from '$lib/server/stripe';
import { PLANS } from '$lib/plans';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!isCloud()) redirect(303, '/pricing');
	if (!locals.user) {
		const plan = url.searchParams.get('plan') === 'creator' ? 'creator' : 'indie';
		redirect(303, `/login?mode=signup&next=${encodeURIComponent(`/subscribe?plan=${plan}`)}`);
	}

	const planParam = url.searchParams.get('plan');
	const plan = planParam === 'creator' ? 'creator' : 'indie';
	const next = url.searchParams.get('next') || '/dashboard?billing=success';
	const cfg = getStripeConfig();

	return {
		plan,
		planMeta: PLANS[plan],
		next,
		user: locals.user,
		billingEnabled: billingEnabled(),
		publishableKey: cfg.publishableKey
	};
};
