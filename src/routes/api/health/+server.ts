import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMode, usePostgres } from '$lib/server/config';
import { cloudBillingGaps } from '$lib/server/stripe';

/** Liveness for Railway / proxies — no DB round-trip. */
export const GET: RequestHandler = async () => {
	const mode = getMode();
	const billingGaps = mode === 'cloud' ? cloudBillingGaps() : [];
	return json({
		ok: true,
		mode,
		db: usePostgres() ? 'postgres' : 'sqlite',
		billingReady: mode !== 'cloud' || billingGaps.length === 0,
		...(billingGaps.length ? { billingGaps } : {})
	});
};
