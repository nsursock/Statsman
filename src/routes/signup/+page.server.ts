import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Canonical signup entry — same magic-link auth as login, signup copy. */
export const load: PageServerLoad = async () => {
	redirect(303, '/login?mode=signup');
};
