import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminToken, isCloud, supabaseAuthConfigured } from '$lib/server/config';
import {
	establishUserSession,
	parseInternalPath,
	setAccessCookie,
	setAdminCookie
} from '$lib/server/auth';
import { createSupabaseAuthClient } from '$lib/server/supabase';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => ({}));

	// Open self-host: explicit enter (no STATSMAN_ADMIN_TOKEN configured)
	if (!isCloud() && body.openAccess) {
		if (getAdminToken()) error(400, 'STATSMAN_ADMIN_TOKEN is set — unlock with the token instead');
		setAccessCookie(cookies);
		return json({ ok: true, mode: 'open' });
	}

	// Self-host admin unlock via shared token
	if (!isCloud() && body.adminToken) {
		const expected = getAdminToken();
		if (!expected || body.adminToken !== expected) error(401, 'Invalid admin token');
		setAdminCookie(cookies, expected);
		setAccessCookie(cookies);
		return json({ ok: true, mode: 'admin' });
	}

	if (!isCloud()) {
		error(400, 'Password login is cloud-only. Unlock with STATSMAN_ADMIN_TOKEN or open access.');
	}

	if (!supabaseAuthConfigured()) {
		error(503, 'Supabase Auth is not configured (SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY)');
	}

	const email = String(body.email ?? '')
		.trim()
		.toLowerCase();
	const password = String(body.password ?? '');
	if (!email || !email.includes('@')) error(400, 'Valid email required');
	if (!password) error(400, 'Password required');

	const supabase = createSupabaseAuthClient();
	const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
	if (authErr) {
		const msg = authErr.message || 'Invalid email or password';
		if (/confirm|verified|not confirmed/i.test(msg)) {
			error(403, 'Confirm your email before signing in — check your inbox.');
		}
		error(401, msg);
	}
	if (!data.user?.email) error(401, 'Login failed');

	const user = await ensureStatsmanUserFromAuth(data.user.email);
	await establishUserSession(cookies, user.id);

	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null);
	return json({ ok: true, mode: 'password', next: next || '/dashboard' });
};
