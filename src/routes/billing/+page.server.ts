import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud, showMarketing } from '$lib/server/config';
import { billingEnabled, getBillingSnapshot } from '$lib/server/stripe';
import { PLANS } from '$lib/plans';
import { getStore } from '$lib/server/db';
import { ensureFounderPlan } from '$lib/server/founder';

export const load: PageServerLoad = async ({ locals }) => {
	if (!showMarketing() || !isCloud()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}
	if (!locals.user) {
		redirect(303, `/login?mode=login&next=${encodeURIComponent('/billing')}`);
	}

	locals.user = await ensureFounderPlan(locals.user);
	if (locals.user.plan === 'founder' || !billingEnabled()) {
		redirect(303, '/dashboard');
	}

	const snapshot = billingEnabled()
		? await getBillingSnapshot(locals.user.id)
		: {
				plan: locals.user.plan || 'free',
				subscriptionId: null,
				status: null,
				cancelAtPeriodEnd: false,
				currentPeriodEnd: null,
				accessEndsAt: null,
				card: null,
				reconciled: false
			};

	if (snapshot.reconciled) {
		locals.user = { ...locals.user, plan: snapshot.plan };
		const store = await getStore();
		const fresh = await store.getUserById(locals.user.id);
		if (fresh) locals.user = fresh;
	}

	const planId = snapshot.plan in PLANS ? snapshot.plan : 'free';

	return {
		user: locals.user,
		billingEnabled: billingEnabled(),
		snapshot,
		planMeta: PLANS[planId as keyof typeof PLANS],
		plans: {
			free: PLANS.free,
			indie: PLANS.indie,
			creator: PLANS.creator
		}
	};
};
