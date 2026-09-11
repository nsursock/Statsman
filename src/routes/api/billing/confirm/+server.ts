import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import {
	billingEnabled,
	getPaymentIntentStatus,
	syncPlanFromSubscription
} from '$lib/server/stripe';
import { getStore } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	const body = await request.json().catch(() => ({}));
	const paymentIntentId = String(body.paymentIntentId ?? '');
	const subscriptionId = String(body.subscriptionId ?? '');
	const planHint = body.plan === 'creator' ? 'creator' : body.plan === 'indie' ? 'indie' : null;

	if (!paymentIntentId && !subscriptionId) {
		error(400, 'paymentIntentId or subscriptionId required');
	}

	if (paymentIntentId) {
		const status = await getPaymentIntentStatus(paymentIntentId);
		if (status.status !== 'succeeded' && status.status !== 'processing') {
			return json({ ok: false, status: status.status });
		}
	}

	if (subscriptionId) {
		const synced = await syncPlanFromSubscription(subscriptionId);
		return json({ ok: true, ...synced });
	}

	// Payment succeeded but no subscription id — set plan from hint as a safety net.
	if (planHint) {
		const store = await getStore();
		await store.setUserPlan(locals.user.id, planHint);
		return json({ ok: true, plan: planHint, userId: locals.user.id });
	}

	return json({ ok: true });
};
