import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud, showMarketing } from '$lib/server/config';

/** Canonical signup entry — same magic-link auth as login, signup copy. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!showMarketing()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}
	redirect(303, '/login?mode=signup');
};
