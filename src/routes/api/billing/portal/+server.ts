import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { createPortalSession } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!locals.user.stripe_customer_id) error(400, 'No Stripe customer yet');

	const session = await createPortalSession(locals.user.stripe_customer_id);
	return json({ url: session.url });
};
