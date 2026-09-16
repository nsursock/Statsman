import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { establishUserSession, parseInternalPath } from '$lib/server/auth';
import {
	authConfigured,
	resetPasswordWithToken,
	type EmailTokenType
} from '$lib/server/auth-provider';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';

/** Complete password reset: verify recovery OTP then set new password. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isCloud()) error(400, 'Password reset is cloud-only');
	if (!authConfigured()) error(503, 'Supabase Auth is not configured');

	const body = await request.json().catch(() => ({}));
	const password = String(body.password ?? '');
	const token_hash = String(body.token_hash ?? '');
	const type = (String(body.type || 'recovery') as EmailTokenType) || 'recovery';
	if (password.length < 8) error(400, 'Password must be at least 8 characters');
	if (!token_hash) error(400, 'Reset token missing — open the link from your email again');

	const res = await resetPasswordWithToken(token_hash, type, password);
	if (!res.ok) {
		error(400, res.error);
	}

	const user = await ensureStatsmanUserFromAuth(res.email);
	await establishUserSession(cookies, user.id);

	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null) || '/dashboard';
	return json({ ok: true, next });
};
