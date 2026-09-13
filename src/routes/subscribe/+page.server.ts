import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getStripeConfig, isCloud, showMarketing } from '$lib/server/config';
import { billingEnabled } from '$lib/server/stripe';
import { parseInternalPath } from '$lib/server/auth';
import { PLANS } from '$lib/plans';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!showMarketing() || !isCloud()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}
	if (!locals.user) {
		const plan =
			url.searchParams.get('plan') === 'creator' ? 'creator'
			: url.searchParams.get('plan') === 'indie' ? 'indie'
			: 'starter';
		redirect(303, `/login?mode=signup&next=${encodeURIComponent(`/subscribe?plan=${plan}`)}`);
	}

	if (!billingEnabled()) redirect(303, '/dashboard');

	const planParam = url.searchParams.get('plan');
	const plan =
		planParam === 'creator' ? 'creator'
		: planParam === 'indie' ? 'indie'
		: 'starter';
	const next = parseInternalPath(url.searchParams.get('next')) || `/dashboard?billing=success&plan=${plan}`;
	const cfg = getStripeConfig();

	// Already on this paid plan — bounce to dashboard (use /billing to change).
	if (locals.user.plan === plan) {
		redirect(303, '/dashboard?billing=success');
	}
	// Founder seat — no Stripe checkout.
	if (locals.user.plan === 'founder' || locals.user.plan === 'selfhost') {
		redirect(303, '/dashboard');
	}

	const payError = url.searchParams.get('error');

	return {
		plan,
		planMeta: PLANS[plan],
		next,
		user: locals.user,
		billingEnabled: billingEnabled(),
		publishableKey: cfg.publishableKey,
		payError: payError === 'payment_failed' ? 'Payment failed or was canceled. Try again.' : ''
	};
};
