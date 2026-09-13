import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import {
	getMailFrom,
	getPublicOrigin,
	getResendApiKey,
	isCloud,
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
	if (!getResendApiKey()) {
		console.warn('[statsman] RESEND_API_KEY unset — magic links only appear in logs / JSON');
	}
	const origin = getPublicOrigin();
	if (!origin || origin.includes('localhost')) {
		console.warn(
			`[statsman] PUBLIC_ORIGIN is ${origin || '(empty)'} — set your HTTPS production URL`
		);
	}
	if (getMailFrom().includes('onboarding@resend.dev')) {
		console.warn('[statsman] MAIL_FROM still uses Resend onboarding address — verify your domain');
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
