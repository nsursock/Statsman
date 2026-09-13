import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getContactEmail, isCloud, showMarketing } from '$lib/server/config';

/** Contact page lives on the commercial/marketing surface. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!showMarketing()) {
		const authed = isCloud() ? Boolean(locals.user) : Boolean(locals.adminOk);
		redirect(303, authed ? '/dashboard' : '/login');
	}
	return {
		contactEmail: getContactEmail()
	};
};
