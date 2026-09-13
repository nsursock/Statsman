import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, changeSubscriptionPlan } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	const body = await request.json().catch(() => ({}));
	const plan =
		body.plan === 'creator' ? 'creator'
		: body.plan === 'indie' ? 'indie'
		: body.plan === 'starter' ? 'starter'
		: null;
	if (!plan) error(400, 'plan must be starter, indie, or creator');

	try {
		const result = await changeSubscriptionPlan(locals.user.id, plan);
		return json({ ok: true, ...result });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not change plan';
		error(400, message);
	}
};
