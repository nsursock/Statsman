import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { billingEnabled, cancelSubscription, resumeSubscription } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isCloud()) error(400, 'Billing is cloud-only');
	if (!locals.user) error(401, 'Login required');
	if (!billingEnabled()) error(503, 'Billing is not configured');

	const body = await request.json().catch(() => ({}));
	const action = body.action === 'resume' ? 'resume' : 'cancel';

	try {
		if (action === 'resume') {
			const result = await resumeSubscription(locals.user.id);
			return json({ ok: true, ...result });
		}
		const atPeriodEnd = body.atPeriodEnd !== false;
		const result = await cancelSubscription(locals.user.id, { atPeriodEnd });
		return json({ ok: true, ...result });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not update subscription';
		error(400, message);
	}
};
