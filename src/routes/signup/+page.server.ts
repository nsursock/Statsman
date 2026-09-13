import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud, showMarketing } from '$lib/server/config';
import { parseInternalPath } from '$lib/server/auth';

/** Canonical signup entry — same magic-link auth as login, signup copy. */
export const load: PageServerLoad = async ({ url, locals }) => {
	if (!showMarketing()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}
	const next = parseInternalPath(url.searchParams.get('next'));
	const q = new URLSearchParams({ mode: 'signup' });
	if (next) q.set('next', next);
	redirect(303, `/login?${q}`);
};
