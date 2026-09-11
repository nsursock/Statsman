import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAdminToken, isCloud } from '$lib/server/config';

export const load: PageServerLoad = async ({ url, locals }) => {
	const modeParam = url.searchParams.get('mode');
	const mode = modeParam === 'signup' ? 'signup' : 'login';

	if (isCloud() && locals.user) redirect(303, '/dashboard');
	if (!isCloud() && locals.adminOk) redirect(303, '/dashboard');

	return {
		mode: mode as 'signup' | 'login',
		isCloud: isCloud(),
		needsAdminToken: !isCloud() && Boolean(getAdminToken()),
		openSelfhost: !isCloud() && !getAdminToken()
	};
};
