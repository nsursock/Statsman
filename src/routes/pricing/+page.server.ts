import type { PageServerLoad } from './$types';
import { billingEnabled } from '$lib/server/stripe';
import { isCloud } from '$lib/server/config';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		isCloud: isCloud(),
		billingEnabled: billingEnabled()
	};
};
