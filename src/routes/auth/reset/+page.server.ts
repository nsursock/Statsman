import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isCloud, supabaseAuthConfigured } from '$lib/server/config';
import { parseInternalPath } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url }) => {
	if (!isCloud()) redirect(303, '/login');

	return {
		authConfigured: supabaseAuthConfigured(),
		tokenHash: url.searchParams.get('token_hash') || '',
		type: url.searchParams.get('type') || 'recovery',
		next: parseInternalPath(url.searchParams.get('next')) || '/dashboard'
	};
};
