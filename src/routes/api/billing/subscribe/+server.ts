import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, createSubscriptionPayment } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	const body = await request.json().catch(() => ({}));
	const plan = body.plan === 'creator' ? 'creator' : 'indie';

	try {
		const result = await createSubscriptionPayment(locals.user.id, locals.user.email, plan);
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not start subscription';
		error(400, message);
	}
};
