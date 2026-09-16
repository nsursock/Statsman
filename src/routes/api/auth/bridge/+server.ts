import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';
import { establishUserSession, parseInternalPath } from '$lib/server/auth';
import {
	authConfigured,
	emailFromAccessToken,
	exchangeCodeForEmail,
	verifyEmailToken,
	type EmailTokenType
} from '$lib/server/auth-provider';
import { ensureStatsmanUserFromAuth } from '$lib/server/user-sync';

/**
 * Finish email confirm / OAuth-style redirects after the browser can see
 * hash fragments (`#access_token=…`) that never reach a server GET.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isCloud()) error(400, 'Auth bridge is cloud-only');
	if (!authConfigured()) error(503, 'Supabase Auth is not configured');

	const body = await request.json().catch(() => ({}));
	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null) || '/dashboard';

	let email: string | undefined;

	const accessToken = String(body.access_token ?? '').trim();
	if (accessToken) {
		const res = await emailFromAccessToken(accessToken);
		if (!res.ok) {
			error(401, res.error);
		}
		email = res.email;
	} else if (body.code) {
		const res = await exchangeCodeForEmail(String(body.code));
		if (!res.ok) {
			error(401, res.error);
		}
		email = res.email;
	} else if (body.token_hash) {
		const type = (String(body.type || 'email') || 'email') as EmailTokenType;
		const res = await verifyEmailToken(String(body.token_hash), type);
		if (!res.ok) {
			error(401, res.error);
		}
		email = res.email;
	} else {
		error(400, 'Missing confirmation credentials');
	}

	const user = await ensureStatsmanUserFromAuth(email!);
	await establishUserSession(cookies, user.id);
	return json({ ok: true, next });
};
