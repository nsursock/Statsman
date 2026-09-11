import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleStripeWebhook } from '$lib/server/stripe';

export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('stripe-signature');
	if (!signature) error(400, 'Missing signature');
	const raw = await request.text();
	try {
		const result = await handleStripeWebhook(raw, signature);
		return json(result);
	} catch (err) {
		console.error(err);
		error(400, 'Webhook error');
	}
};
