import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendContactMessage } from '$lib/server/mail';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));

	const name = String(body.name ?? '').trim().slice(0, 120);
	const email = String(body.email ?? '').trim().toLowerCase().slice(0, 160);
	const message = String(body.message ?? '').trim().slice(0, 4000);

	if (!name) error(400, 'Name is required');
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error(400, 'Valid email required');
	if (message.length < 5) error(400, 'Message is too short');

	try {
		const result = await sendContactMessage({ name, email, message });
		return json({ ok: true, dev: Boolean(result.dev) });
	} catch (err) {
		console.error('[statsman] contact form failed:', err);
		error(500, 'Could not send message. Please email us directly.');
	}
};
