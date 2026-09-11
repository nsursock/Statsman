import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Old onboarding route — setup now lives as a modal on the dashboard. */
export const load: PageServerLoad = async () => {
	redirect(303, '/dashboard');
};
