import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublicOrigin, isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { createSupabaseAuthClient } from '$lib/server/supabase';

/** Request a password-reset email (Supabase). */
export const POST: RequestHandler = async ({ request }) => {
	if (!isCloud()) error(400, 'Password reset is cloud-only');
	if (!supabaseAuthConfigured()) {
		error(503, 'Supabase Auth is not configured');
	}

	const body = await request.json().catch(() => ({}));
	const email = String(body.email ?? '')
		.trim()
		.toLowerCase();
	if (!email || !email.includes('@')) error(400, 'Valid email required');

	const origin = getPublicOrigin();
	const redirectTo = `${origin}/auth/reset`;

	const supabase = createSupabaseAuthClient();
	const { error: authErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
	if (authErr) error(400, authErr.message || 'Could not send reset email');

	return json({
		ok: true,
		message: 'If that email has an account, a reset link is on the way.'
	});
};
