import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import {
	getPublicOrigin,
	isCloud,
	supabaseAuthConfigured,
	usePostgres
} from '$lib/server/config';
import { adminAuthorized, readSessionUser } from '$lib/server/auth';
import { cloudBillingGaps, billingEnabled } from '$lib/server/stripe';

let warnedCloud = false;

function warnCloudConfigOnce() {
	if (building || warnedCloud || !isCloud()) return;
	warnedCloud = true;
	const gaps = cloudBillingGaps();
	if (gaps.length) {
		console.warn(`[statsman] cloud billing incomplete — missing ${gaps.join(', ')}`);
	} else if (!billingEnabled() && isCloud()) {
		console.info('[statsman] cloud free beta — STATSMAN_BILLING=off (Stripe dormant)');
	}
	if (!usePostgres()) {
		console.warn('[statsman] cloud mode without Postgres — use DATABASE_URL or PG* for production');
	}
	if (!supabaseAuthConfigured()) {
		console.warn(
			'[statsman] Supabase Auth unset — set SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY for cloud login'
		);
	}
	const origin = getPublicOrigin();
	if (!origin || origin.includes('localhost')) {
		console.warn(
			`[statsman] PUBLIC_ORIGIN is ${origin || '(empty)'} — set your HTTPS production URL`
		);
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	warnCloudConfigOnce();
	const user = await readSessionUser(event.cookies);
	event.locals.user = user;
	event.locals.isCloud = isCloud();
	event.locals.adminOk = adminAuthorized(event.cookies, event.request);
	return resolve(event);
};
