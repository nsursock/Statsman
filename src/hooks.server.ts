import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import {
	getPublicOrigin,
	isCloud,
	shouldRedirectToCanonical,
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

function requestHostname(event: Parameters<Handle>[0]['event']): string {
	const xf = event.request.headers.get('x-forwarded-host');
	if (xf) return xf.split(',')[0].trim().split(':')[0];
	const host = event.request.headers.get('host');
	if (host) return host.split(':')[0];
	return event.url.hostname;
}

export const handle: Handle = async ({ event, resolve }) => {
	warnCloudConfigOnce();

	// Canonical domain: Railway *.up.railway.app (and any other alias) → PUBLIC_ORIGIN.
	// Skip health checks so Railway probes on the default hostname keep working.
	const path = event.url.pathname;
	if (path !== '/api/health' && shouldRedirectToCanonical(requestHostname(event))) {
		const target = new URL(path + event.url.search, getPublicOrigin());
		redirect(301, target.toString());
	}

	const user = await readSessionUser(event.cookies);
	event.locals.user = user;
	event.locals.isCloud = isCloud();
	event.locals.adminOk = adminAuthorized(event.cookies, event.request);
	return resolve(event);
};
