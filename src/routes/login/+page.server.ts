import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAdminToken, isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { parseInternalPath } from '$lib/server/auth';

function softAuthError(raw: string | null): string {
	if (!raw) return '';
	const msg = String(raw).slice(0, 200);
	if (/missing confirmation token/i.test(msg)) {
		return 'Email confirmed — sign in with your password.';
	}
	return msg;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const modeParam = url.searchParams.get('mode');
	const mode = modeParam === 'signup' ? 'signup' : 'login';
	const next = parseInternalPath(url.searchParams.get('next'));
	const rawError = url.searchParams.get('error');
	const authError = softAuthError(rawError);

	if (isCloud() && locals.user) redirect(303, next ?? '/dashboard');
	if (!isCloud() && locals.adminOk) redirect(303, next ?? '/dashboard');

	return {
		mode: mode as 'signup' | 'login',
		next,
		isCloud: isCloud(),
		needsAdminToken: !isCloud() && Boolean(getAdminToken()),
		openSelfhost: !isCloud() && !getAdminToken(),
		authConfigured: supabaseAuthConfigured(),
		authError
	};
};
