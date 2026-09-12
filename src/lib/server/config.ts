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

export type PostgresConfig =
	| { kind: 'url'; url: string }
	| {
			kind: 'params';
			host: string;
			port: number;
			database: string;
			user: string;
			password: string;
	  };

/**
 * Postgres via DATABASE_URL **or** discrete params (Supabase pooler-friendly).
 * Use PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD — never bare HOST
 * (HOST is the HTTP bind address for Railway, e.g. ::).
 */
export function getPostgresConfig(): PostgresConfig | undefined {
	const url = (env.DATABASE_URL ?? '').trim();
	if (url && /^postgres(ql)?:\/\//i.test(url)) {
		return { kind: 'url', url };
	}

	const host = (env.PGHOST || env.POSTGRES_HOST || '').trim();
	const user = (env.PGUSER || env.POSTGRES_USER || '').trim();
	const password = env.PGPASSWORD || env.POSTGRES_PASSWORD || '';
	const database = (env.PGDATABASE || env.POSTGRES_DB || 'postgres').trim();
	const port = Number(env.PGPORT || env.POSTGRES_PORT || 5432);

	if (host && user && password) {
		return {
			kind: 'params',
			host,
			port: Number.isFinite(port) && port > 0 ? port : 5432,
			database: database || 'postgres',
			user,
			password
		};
	}
	return undefined;
}

/** @deprecated Prefer getPostgresConfig(); kept for health/debug display. */
export function getDatabaseUrl(): string | undefined {
	const cfg = getPostgresConfig();
	if (!cfg) return undefined;
	if (cfg.kind === 'url') return cfg.url;
	return `postgres://${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

export function getDatabasePath(): string {
	return env.DATABASE_PATH || './data/statsman.db';
}

export function usePostgres(): boolean {
	return Boolean(getPostgresConfig());
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
