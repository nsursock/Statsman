import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCloud } from '$lib/server/config';

/** Legacy magic-link verify — cloud auth now uses Supabase `/auth/callback`. */
export const GET: RequestHandler = async ({ url }) => {
	const next = url.searchParams.get('next');
	const q = next ? `?next=${encodeURIComponent(next)}` : '';
	if (isCloud()) redirect(303, `/login${q}`);
	redirect(303, '/login');
};
