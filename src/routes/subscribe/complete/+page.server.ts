import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, syncPlanFromSubscription } from '$lib/server/stripe';

/**
 * 3DS / redirect return from Payment Element.
 * Never trust `?plan=` — only sync from Stripe when we have a subscription id.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	if (!isCloud()) redirect(303, '/');
	if (!locals.user) redirect(303, '/login');

	const planHint = url.searchParams.get('plan') === 'creator' ? 'creator' : 'indie';
	const next = url.searchParams.get('next') || '/dashboard?billing=success';
	const subscriptionId = url.searchParams.get('subscription_id');
	const redirectStatus = url.searchParams.get('redirect_status');

	if (redirectStatus === 'failed') {
		redirect(303, `/subscribe?plan=${planHint}&error=payment_failed`);
	}

	if (billingEnabled() && subscriptionId) {
		try {
			await syncPlanFromSubscription(subscriptionId, { userId: locals.user.id });
		} catch (err) {
			console.error('[subscribe/complete] sync failed', err);
			// Webhook / dashboard reconcile will catch up — do not soft-set from query.
		}
	}

	redirect(303, next.startsWith('/') ? next : `/${next}`);
};
