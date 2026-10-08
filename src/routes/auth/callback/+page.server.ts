import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud } from '$lib/server/config';
import { consumeAuthNextCookie, establishUserSession, parseInternalPath } from '$lib/server/auth';
import {
	authConfigured,
	exchangeCodeForEmail,
	verifyEmailToken,
	type EmailTokenType
} from '$lib/server/auth-provider';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';

/**
 * Server-side path when Supabase puts `code` / `token_hash` in the query string.
 * Hash fragments (`#access_token=…`) are handled in +page.svelte → /api/auth/bridge.
 */
export const load: PageServerLoad = async ({ url, cookies }) => {
	if (!isCloud()) redirect(303, '/login');

	const next =
		parseInternalPath(url.searchParams.get('next')) || consumeAuthNextCookie(cookies) || '/dashboard';
	const supabaseError =
		url.searchParams.get('error_description') || url.searchParams.get('error') || '';

	if (!authConfigured()) {
		redirect(303, `/login?error=${encodeURIComponent('Supabase Auth is not configured')}`);
	}

	if (supabaseError) {
		redirect(303, `/login?error=${encodeURIComponent(supabaseError)}`);
	}

	const token_hash = url.searchParams.get('token_hash');
	const type = (url.searchParams.get('type') || 'email') as EmailTokenType;
	const code = url.searchParams.get('code');

	if (token_hash && type === 'recovery') {
		redirect(
			303,
			`/auth/reset?token_hash=${encodeURIComponent(token_hash)}&type=recovery&next=${encodeURIComponent(next)}`
		);
	}

	if (code) {
		const res = await exchangeCodeForEmail(code);
		if (!res.ok) {
			redirect(303, `/login?error=${encodeURIComponent(res.error)}`);
		}
		const user = await ensureStatsmanUserFromAuth(res.email);
		await establishUserSession(cookies, user.id);
		redirect(303, next);
	}

	if (token_hash) {
		const res = await verifyEmailToken(token_hash, type);
		if (!res.ok) {
			redirect(303, `/login?error=${encodeURIComponent(res.error)}`);
		}
		const user = await ensureStatsmanUserFromAuth(res.email);
		await establishUserSession(cookies, user.id);
		redirect(303, next);
	}

	// No query tokens — browser page will read the URL hash (implicit confirm links).
	return { next };
};
