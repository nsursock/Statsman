import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStore, hashToken, newToken } from '$lib/server/db';
import { parseInternalPath, setSessionCookie } from '$lib/server/auth';
import { isCloud } from '$lib/server/config';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!isCloud()) error(400, 'Magic-link verify is cloud-only');

	const token = url.searchParams.get('token');
	if (!token) error(400, 'Missing token');

	const store = await getStore();
	const userId = await store.consumeLoginToken(hashToken(token));
	if (!userId) error(400, 'Invalid or expired link');

	const sessionToken = newToken(32);
	const maxAge = 60 * 60 * 24 * 30;
	await store.createSession(userId, hashToken(sessionToken), Date.now() + maxAge * 1000);
	setSessionCookie(cookies, sessionToken, maxAge);

	const next = parseInternalPath(url.searchParams.get('next')) ?? '/dashboard';
	redirect(303, next);
};
