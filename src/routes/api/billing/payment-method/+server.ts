import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, setDefaultPaymentMethod } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	const body = await request.json().catch(() => ({}));
	const paymentMethodId = String(body.paymentMethodId ?? '');
	if (!paymentMethodId) error(400, 'paymentMethodId required');

	try {
		const result = await setDefaultPaymentMethod(locals.user.id, paymentMethodId);
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not save payment method';
		error(400, message);
	}
};
