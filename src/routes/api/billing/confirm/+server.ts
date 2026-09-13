import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import {
	billingEnabled,
	getPaymentIntentStatus,
	syncPlanFromSubscription
} from '$lib/server/stripe';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	const body = await request.json().catch(() => ({}));
	const paymentIntentId = String(body.paymentIntentId ?? '');
	const subscriptionId = String(body.subscriptionId ?? '');

	if (!paymentIntentId && !subscriptionId) {
		error(400, 'paymentIntentId or subscriptionId required');
	}

	if (paymentIntentId) {
		const status = await getPaymentIntentStatus(paymentIntentId);
		if (status.status !== 'succeeded' && status.status !== 'processing') {
			return json({ ok: false, status: status.status });
		}
	}

	// Only sync from Stripe subscription — never trust a client plan hint.
	if (subscriptionId) {
		const synced = await syncPlanFromSubscription(subscriptionId, {
			userId: locals.user.id
		});
		return json({ ok: true, ...synced });
	}

	return json({ ok: true, plan: null });
};
