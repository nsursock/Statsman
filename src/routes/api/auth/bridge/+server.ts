import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { establishUserSession, parseInternalPath } from '$lib/server/auth';
import { createSupabaseAuthClient } from '$lib/server/supabase';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Finish email confirm / OAuth-style redirects after the browser can see
 * hash fragments (`#access_token=…`) that never reach a server GET.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isCloud()) error(400, 'Auth bridge is cloud-only');
	if (!supabaseAuthConfigured()) error(503, 'Supabase Auth is not configured');

	const body = await request.json().catch(() => ({}));
	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null) || '/dashboard';
	const supabase = createSupabaseAuthClient();

	let email: string | undefined;

	const accessToken = String(body.access_token ?? '').trim();
	if (accessToken) {
		const { data, error: authErr } = await supabase.auth.getUser(accessToken);
		if (authErr || !data.user?.email) {
			error(401, authErr?.message || 'Invalid confirmation session');
		}
		email = data.user.email;
	} else if (body.code) {
		const { data, error: authErr } = await supabase.auth.exchangeCodeForSession(String(body.code));
		if (authErr || !data.user?.email) {
			error(401, authErr?.message || 'Could not confirm email');
		}
		email = data.user.email;
	} else if (body.token_hash) {
		const type = (String(body.type || 'email') || 'email') as EmailOtpType;
		const { data, error: authErr } = await supabase.auth.verifyOtp({
			token_hash: String(body.token_hash),
			type
		});
		if (authErr || !data.user?.email) {
			error(401, authErr?.message || 'Could not confirm email');
		}
		email = data.user.email;
	} else {
		error(400, 'Missing confirmation credentials');
	}

	const user = await ensureStatsmanUserFromAuth(email!);
	await establishUserSession(cookies, user.id);
	return json({ ok: true, next });
};
