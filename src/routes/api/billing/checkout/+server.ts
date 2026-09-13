import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { getPublicOrigin } from '$lib/server/config';

/**
 * Legacy endpoint — hosted Checkout is retired in favor of the native
 * /subscribe Payment Element page. Returns a Statsman URL, not Stripe's.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');

	const body = await request.json().catch(() => ({}));
	const plan =
		body.plan === 'creator' ? 'creator'
		: body.plan === 'indie' ? 'indie'
		: 'starter';
	const next =
		typeof body.successPath === 'string' ? body.successPath : '/dashboard?billing=success';

	const origin = getPublicOrigin();
	const url = `${origin}/subscribe?plan=${plan}&next=${encodeURIComponent(next)}`;
	return json({ url });
};
