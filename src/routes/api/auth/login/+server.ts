import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStore, hashToken, newToken } from '$lib/server/db';
import { sendMagicLink } from '$lib/server/mail';
import { getAdminToken, isCloud } from '$lib/server/config';
import { setAccessCookie, setAdminCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();

	// Open self-host: explicit enter (no ADMIN_TOKEN configured)
	if (!isCloud() && body.openAccess) {
		if (getAdminToken()) error(400, 'ADMIN_TOKEN is set — unlock with the token instead');
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

	const email = String(body.email ?? '')
		.trim()
		.toLowerCase();
	if (!email || !email.includes('@')) error(400, 'Valid email required');

	const store = await getStore();
	const user = await store.upsertUserByEmail(email);
	const token = newToken(24);
	await store.createLoginToken(user.id, hashToken(token), Date.now() + 15 * 60 * 1000);
	const result = await sendMagicLink(email, token);

	return json({
		ok: true,
		mode: 'magic',
		devLink: result.devLink ?? null
	});
};
