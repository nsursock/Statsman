import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { establishUserSession, parseInternalPath } from '$lib/server/auth';
import { createSupabaseAuthClient } from '$lib/server/supabase';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';
import type { EmailOtpType } from '@supabase/supabase-js';

/** Complete password reset: verify recovery OTP then set new password. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isCloud()) error(400, 'Password reset is cloud-only');
	if (!supabaseAuthConfigured()) error(503, 'Supabase Auth is not configured');

	const body = await request.json().catch(() => ({}));
	const password = String(body.password ?? '');
	const token_hash = String(body.token_hash ?? '');
	const type = (String(body.type || 'recovery') as EmailOtpType) || 'recovery';
	if (password.length < 8) error(400, 'Password must be at least 8 characters');
	if (!token_hash) error(400, 'Reset token missing — open the link from your email again');

	const supabase = createSupabaseAuthClient();
	const { data, error: verifyErr } = await supabase.auth.verifyOtp({ token_hash, type });
	if (verifyErr || !data.user?.email) {
		error(400, verifyErr?.message || 'Invalid or expired reset link');
	}
	if (data.session) {
		await supabase.auth.setSession(data.session);
	}

	const { error: updateErr } = await supabase.auth.updateUser({ password });
	if (updateErr) error(400, updateErr.message || 'Could not update password');

	const user = await ensureStatsmanUserFromAuth(data.user.email);
	await establishUserSession(cookies, user.id);

	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null) || '/dashboard';
	return json({ ok: true, next });
};
