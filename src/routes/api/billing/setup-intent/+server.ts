import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, createBillingSetupIntent } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	try {
		const result = await createBillingSetupIntent(locals.user.id, locals.user.email);
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not start card setup';
		error(400, message);
	}
};
