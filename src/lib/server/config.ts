import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/** How this deploy behaves:
 *  - selfhost — customer OSS install: app only (login → dashboard)
 *  - hosted   — main product site (Railway + Supabase): marketing + your dashboard
 *  - cloud    — main product site + multi-user magic-link / Stripe
 */
export type StatsmanMode = 'selfhost' | 'cloud' | 'hosted';

export function getMode(): StatsmanMode {
	const raw = (env.STATSMAN_MODE ?? 'selfhost').toLowerCase();
	if (raw === 'cloud') return 'cloud';
	if (raw === 'hosted') return 'hosted';
	return 'selfhost';
}

export function isCloud(): boolean {
	return getMode() === 'cloud';
}

/** Marketing landing, pricing, signup — not shown on pure self-host installs. */
export function showMarketing(): boolean {
	const mode = getMode();
	return mode === 'cloud' || mode === 'hosted';
}

export function getPublicOrigin(): string {
	return (publicEnv.PUBLIC_ORIGIN ?? env.PUBLIC_ORIGIN ?? 'http://localhost:5173').replace(
		/\/$/,
		''
	);
}

export function getSessionSecret(): string {
	return env.SESSION_SECRET || env.ADMIN_TOKEN || 'dev-insecure-session-secret-change-me';
}

export function getAdminToken(): string | undefined {
	return env.ADMIN_TOKEN || undefined;
}

export function getDatabaseUrl(): string | undefined {
	return env.DATABASE_URL || undefined;
}

export function getDatabasePath(): string {
	return env.DATABASE_PATH || './data/statsman.db';
}

export function usePostgres(): boolean {
	const url = getDatabaseUrl();
	return Boolean(url && /^postgres(ql)?:\/\//i.test(url));
}

export function getStripeConfig() {
	return {
		secretKey: env.STRIPE_SECRET_KEY || '',
		publishableKey: publicEnv.PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
		webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
		priceIndie: env.STRIPE_PRICE_INDIE || '',
		priceCreator: env.STRIPE_PRICE_CREATOR || ''
	};
}

export function getResendApiKey(): string | undefined {
	return env.RESEND_API_KEY || undefined;
}

export function getMailFrom(): string {
	return env.MAIL_FROM || 'Statsman <onboarding@resend.dev>';
}
