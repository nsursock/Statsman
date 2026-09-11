import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStore, hashToken, newToken } from '$lib/server/db';
import { setSessionCookie } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	if (!token) error(400, 'Missing token');

	const store = await getStore();
	const userId = await store.consumeLoginToken(hashToken(token));
	if (!userId) error(400, 'Invalid or expired link');

	const sessionToken = newToken(32);
	const maxAge = 60 * 60 * 24 * 30;
	await store.createSession(userId, hashToken(sessionToken), Date.now() + maxAge * 1000);
	setSessionCookie(cookies, sessionToken, maxAge);

	// Always land on dashboard; first-time setup is an in-dashboard modal.
	redirect(303, '/dashboard');
};
