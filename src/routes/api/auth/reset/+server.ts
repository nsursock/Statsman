import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthEmailOrigin, isCloud } from '$lib/server/config';
import { authConfigured, sendPasswordReset } from '$lib/server/auth-provider';

/** Request a password-reset email (Supabase). */
export const POST: RequestHandler = async ({ request, url }) => {
	if (!isCloud()) error(400, 'Password reset is cloud-only');
	if (!authConfigured()) {
		error(503, 'Supabase Auth is not configured');
	}

	const body = await request.json().catch(() => ({}));
	const email = String(body.email ?? '')
		.trim()
		.toLowerCase();
	if (!email || !email.includes('@')) error(400, 'Valid email required');

	const redirectTo = `${getAuthEmailOrigin(url, request)}/auth/reset`;

	const res = await sendPasswordReset(email, redirectTo);
	if (!res.ok) error(400, res.error);

	return json({
		ok: true,
		message: 'If that email has an account, a reset link is on the way.'
	});
};
