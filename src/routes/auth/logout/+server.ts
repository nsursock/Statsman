import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	clearAccessCookie,
	clearAdminCookie,
	clearSessionCookie,
	SESSION_COOKIE
} from '$lib/server/auth';
import { getStore, hashToken } from '$lib/server/db';

export const GET: RequestHandler = async ({ cookies }) => {
	const raw = cookies.get(SESSION_COOKIE);
	if (raw) {
		const store = await getStore();
		await store.deleteSession(hashToken(raw));
	}
	clearSessionCookie(cookies);
	clearAdminCookie(cookies);
	clearAccessCookie(cookies);
	redirect(303, '/');
};

export const POST: RequestHandler = async (event) => GET(event);
