import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAdminToken, isCloud } from '$lib/server/config';
import { parseInternalPath } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url, locals }) => {
	const modeParam = url.searchParams.get('mode');
	const mode = modeParam === 'signup' ? 'signup' : 'login';
	const next = parseInternalPath(url.searchParams.get('next'));

	if (isCloud() && locals.user) redirect(303, next ?? '/dashboard');
	if (!isCloud() && locals.adminOk) redirect(303, next ?? '/dashboard');

	return {
		mode: mode as 'signup' | 'login',
		next,
		isCloud: isCloud(),
		needsAdminToken: !isCloud() && Boolean(getAdminToken()),
		openSelfhost: !isCloud() && !getAdminToken()
	};
};
