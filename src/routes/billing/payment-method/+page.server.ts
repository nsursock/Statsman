import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getStripeConfig, isCloud, showMarketing } from '$lib/server/config';
import { billingEnabled, getBillingSnapshot } from '$lib/server/stripe';

export const load: PageServerLoad = async ({ locals }) => {
	if (!showMarketing() || !isCloud()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}
	if (!locals.user) {
		redirect(303, `/login?mode=login&next=${encodeURIComponent('/billing/payment-method')}`);
	}
	if (!billingEnabled()) redirect(303, '/billing');

	const snapshot = await getBillingSnapshot(locals.user.id);
	const cfg = getStripeConfig();

	return {
		user: locals.user,
		billingEnabled: true,
		publishableKey: cfg.publishableKey,
		card: snapshot.card,
		plan: snapshot.plan
	};
};
