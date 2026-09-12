import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMode, usePostgres } from '$lib/server/config';

/** Liveness for Railway / proxies — no DB round-trip. */
export const GET: RequestHandler = async () =>
	json({
		ok: true,
		mode: getMode(),
		db: usePostgres() ? 'postgres' : 'sqlite'
	});
