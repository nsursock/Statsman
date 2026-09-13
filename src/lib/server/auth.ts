import type { Cookies } from '@sveltejs/kit';
import { getAdminToken, getSessionSecret, isCloud } from '$lib/server/config';
import { getStore, hashToken, newToken } from '$lib/server/db';
import type { User } from '$lib/server/db';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'statsman_session';
export const ADMIN_COOKIE = 'statsman_admin';
/** Open self-host: explicit “entered console” flag so logout actually sticks. */
export const ACCESS_COOKIE = 'statsman_access';

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function tokensEqual(a: string, b: string) {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}

export async function readSessionUser(cookies: Cookies): Promise<User | null> {
	const raw = cookies.get(SESSION_COOKIE);
	if (!raw) return null;
	const store = await getStore();
	const user = await store.getSessionUser(hashToken(raw));
	return user ?? null;
}

export function setSessionCookie(cookies: Cookies, token: string, maxAgeSec: number) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: maxAgeSec
	});
}

/** After Supabase Auth succeeds — mint Statsman app session (keeps locals.user guards working). */
export async function establishUserSession(cookies: Cookies, userId: string) {
	const store = await getStore();
	const sessionToken = newToken(32);
	await store.createSession(userId, hashToken(sessionToken), Date.now() + SESSION_MAX_AGE_SEC * 1000);
	setSessionCookie(cookies, sessionToken, SESSION_MAX_AGE_SEC);
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function adminAuthorized(cookies: Cookies, request?: Request): boolean {
	const expected = getAdminToken();
	if (!expected) {
		// Cloud without token is never “admin”.
		if (isCloud()) return false;
		// Open self-host: must have explicitly entered (ACCESS_COOKIE), otherwise
		// logout → /login would immediately treat the user as authorized again.
		return cookies.get(ACCESS_COOKIE) === '1';
	}
	const fromCookie = cookies.get(ADMIN_COOKIE);
	if (fromCookie && tokensEqual(fromCookie, expected)) return true;
	const header = request?.headers.get('authorization');
	if (header?.startsWith('Bearer ') && tokensEqual(header.slice(7), expected)) return true;
	return false;
}

export function setAdminCookie(cookies: Cookies, token: string) {
	cookies.set(ADMIN_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30
	});
}

export function clearAdminCookie(cookies: Cookies) {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export function setAccessCookie(cookies: Cookies) {
	cookies.set(ACCESS_COOKIE, '1', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30
	});
}

export function clearAccessCookie(cookies: Cookies) {
	cookies.delete(ACCESS_COOKIE, { path: '/' });
}

export function signState(payload: string): string {
	const h = createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
	return `${payload}.${h}`;
}

/** Relative in-app path only — blocks open redirects after auth / billing. */
export function parseInternalPath(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const path = raw.trim();
	if (!path.startsWith('/') || path.startsWith('//')) return null;
	if (path.includes('://') || path.includes('\\')) return null;
	return path;
}
