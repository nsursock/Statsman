import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStore, hashToken, newToken } from '$lib/server/db';
import { sendMagicLink } from '$lib/server/mail';
import { getAdminToken, isCloud } from '$lib/server/config';
import { parseInternalPath, setAccessCookie, setAdminCookie } from '$lib/server/auth';

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

	// Self-host / hosted: only token or open-console unlock — never magic-link.
	if (!isCloud()) {
		error(400, 'Magic-link login is cloud-only. Unlock with ADMIN_TOKEN or open access.');
	}

	const email = String(body.email ?? '')
		.trim()
		.toLowerCase();
	if (!email || !email.includes('@')) error(400, 'Valid email required');

	const next = parseInternalPath(typeof body.next === 'string' ? body.next : null);

	const store = await getStore();
	let user = await store.upsertUserByEmail(email);
	const { ensureFounderPlan } = await import('$lib/server/founder');
	user = await ensureFounderPlan(user);
	const token = newToken(24);
	await store.createLoginToken(user.id, hashToken(token), Date.now() + 15 * 60 * 1000);
	const result = await sendMagicLink(email, token, next);

	return json({
		ok: true,
		mode: 'magic',
		devLink: result.devLink ?? null
	});
};
