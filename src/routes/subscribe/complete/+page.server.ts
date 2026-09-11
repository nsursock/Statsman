import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, syncPlanFromSubscription } from '$lib/server/stripe';
import { getStore } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!isCloud()) redirect(303, '/');
	if (!locals.user) redirect(303, '/login');

	const plan = url.searchParams.get('plan') === 'creator' ? 'creator' : 'indie';
	const next = url.searchParams.get('next') || '/dashboard?billing=success';
	const subscriptionId = url.searchParams.get('subscription_id');
	const redirectStatus = url.searchParams.get('redirect_status');

	if (billingEnabled() && subscriptionId && redirectStatus !== 'failed') {
		try {
			await syncPlanFromSubscription(subscriptionId);
		} catch {
			if (plan) {
				const store = await getStore();
				await store.setUserPlan(locals.user.id, plan);
			}
		}
	} else if (redirectStatus === 'succeeded' || !redirectStatus) {
		// Soft-set plan; webhook remains source of truth.
		const store = await getStore();
		await store.setUserPlan(locals.user.id, plan);
	}

	redirect(303, next.startsWith('/') ? next : `/${next}`);
};
