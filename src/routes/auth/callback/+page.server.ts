import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { establishUserSession, parseInternalPath } from '$lib/server/auth';
import { createSupabaseAuthClient } from '$lib/server/supabase';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Server-side path when Supabase puts `code` / `token_hash` in the query string.
 * Hash fragments (`#access_token=…`) are handled in +page.svelte → /api/auth/bridge.
 */
export const load: PageServerLoad = async ({ url, cookies }) => {
	if (!isCloud()) redirect(303, '/login');

	const next = parseInternalPath(url.searchParams.get('next')) || '/dashboard';
	const supabaseError =
		url.searchParams.get('error_description') || url.searchParams.get('error') || '';

	if (!supabaseAuthConfigured()) {
		redirect(303, `/login?error=${encodeURIComponent('Supabase Auth is not configured')}`);
	}

	if (supabaseError) {
		redirect(303, `/login?error=${encodeURIComponent(supabaseError)}`);
	}

	const supabase = createSupabaseAuthClient();
	const token_hash = url.searchParams.get('token_hash');
	const type = (url.searchParams.get('type') || 'email') as EmailOtpType;
	const code = url.searchParams.get('code');

	if (token_hash && type === 'recovery') {
		redirect(
			303,
			`/auth/reset?token_hash=${encodeURIComponent(token_hash)}&type=recovery&next=${encodeURIComponent(next)}`
		);
	}

	if (code) {
		const { data, error: authErr } = await supabase.auth.exchangeCodeForSession(code);
		if (authErr || !data.user?.email) {
			redirect(303, `/login?error=${encodeURIComponent(authErr?.message || 'Confirm failed')}`);
		}
		const user = await ensureStatsmanUserFromAuth(data.user.email);
		await establishUserSession(cookies, user.id);
		redirect(303, next);
	}

	if (token_hash) {
		const { data, error: authErr } = await supabase.auth.verifyOtp({ token_hash, type });
		if (authErr || !data.user?.email) {
			redirect(303, `/login?error=${encodeURIComponent(authErr?.message || 'Confirm failed')}`);
		}
		const user = await ensureStatsmanUserFromAuth(data.user.email);
		await establishUserSession(cookies, user.id);
		redirect(303, next);
	}

	// No query tokens — browser page will read the URL hash (implicit confirm links).
	return { next };
};
