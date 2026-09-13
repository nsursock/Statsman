import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublicOrigin, isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { establishUserSession, parseInternalPath } from '$lib/server/auth';
import { createSupabaseAuthClient } from '$lib/server/supabase';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isCloud()) error(400, 'Signup is cloud-only');
	if (!supabaseAuthConfigured()) {
		error(503, 'Supabase Auth is not configured (SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY)');
	}

	const body = await request.json().catch(() => ({}));
	const email = String(body.email ?? '')
		.trim()
		.toLowerCase();
	const password = String(body.password ?? '');
	if (!email || !email.includes('@')) error(400, 'Valid email required');
	if (password.length < 8) error(400, 'Password must be at least 8 characters');

	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null) || '/dashboard';
	const origin = getPublicOrigin();
	const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

	const supabase = createSupabaseAuthClient();
	const { data, error: authErr } = await supabase.auth.signUp({
		email,
		password,
		options: { emailRedirectTo: redirectTo }
	});
	if (authErr) error(400, authErr.message || 'Could not create account');

	// Pre-create Statsman user so sites/plan attach by email after verify.
	await ensureStatsmanUserFromAuth(email);

	// If email confirmation is disabled in Supabase, a session is returned immediately.
	if (data.session && data.user?.email) {
		const user = await ensureStatsmanUserFromAuth(data.user.email);
		await establishUserSession(cookies, user.id);
		return json({ ok: true, mode: 'password', confirmed: true, next });
	}

	return json({
		ok: true,
		mode: 'confirm',
		confirmed: false,
		message: 'Check your email to confirm your account, then sign in.'
	});
};
