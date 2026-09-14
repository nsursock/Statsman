import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/** How this deploy behaves:
 *  - selfhost — customer OSS install: app only (login → dashboard)
 *  - cloud    — main product site + multi-user Supabase Auth / Stripe
 */
export type StatsmanMode = 'selfhost' | 'cloud';

export function getMode(): StatsmanMode {
	const raw = (env.STATSMAN_MODE ?? 'selfhost').toLowerCase();
	return raw === 'cloud' ? 'cloud' : 'selfhost';
}

export function isCloud(): boolean {
	return getMode() === 'cloud';
}

/** Marketing landing, pricing, signup — shown on cloud only. */
export function showMarketing(): boolean {
	return isCloud();
}

export function getPublicOrigin(): string {
	return (publicEnv.PUBLIC_ORIGIN ?? env.PUBLIC_ORIGIN ?? 'http://localhost:5173').replace(
		/\/$/,
		''
	);
}

/** Hostname for PUBLIC_ORIGIN, or null if unset/invalid. */
export function getCanonicalHostname(): string | null {
	try {
		const host = new URL(getPublicOrigin()).hostname.toLowerCase();
		if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;
		return host;
	} catch {
		return null;
	}
}

/**
 * When PUBLIC_ORIGIN is a real public host, 301 other hosts (e.g. *.up.railway.app)
 * there so auth/Stripe/SEO stay on the custom domain.
 */
export function shouldRedirectToCanonical(requestHost: string): boolean {
	const canonical = getCanonicalHostname();
	if (!canonical) return false;
	const host = requestHost.split(':')[0].toLowerCase();
	if (!host || host === canonical) return false;
	if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
	return true;
}

export function getSessionSecret(): string {
	return env.STATSMAN_SESSION_SECRET || env.SESSION_SECRET || env.STATSMAN_ADMIN_TOKEN || env.ADMIN_TOKEN || 'dev-insecure-session-secret-change-me';
}

export function getAdminToken(): string | undefined {
	return env.STATSMAN_ADMIN_TOKEN || env.ADMIN_TOKEN || undefined;
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

function readPostgresUrl(): PostgresConfig | undefined {
	const url = (env.DATABASE_URL ?? '').trim();
	if (url && /^postgres(ql)?:\/\//i.test(url)) {
		return { kind: 'url', url };
	}
	return undefined;
}

function readPostgresParams(): PostgresConfig | undefined {
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

/**
 * Ordered connection attempts: DATABASE_URL first (if set), then discrete PG*.
 * Use PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD — never bare HOST
 * (HOST is the HTTP bind address for Railway, e.g. ::).
 */
export function getPostgresCandidates(): PostgresConfig[] {
	const out: PostgresConfig[] = [];
	const url = readPostgresUrl();
	const params = readPostgresParams();
	if (url) out.push(url);
	if (params) out.push(params);
	return out;
}

/** First configured source (URL preferred when both exist). */
export function getPostgresConfig(): PostgresConfig | undefined {
	return getPostgresCandidates()[0];
}

/** @deprecated Prefer getPostgresConfig(); kept for health/debug display. */
export function getDatabaseUrl(): string | undefined {
	const cfg = getPostgresConfig();
	if (!cfg) return undefined;
	if (cfg.kind === 'url') return cfg.url;
	return `postgres://${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

export function getDatabasePath(): string {
	return env.STATSMAN_DATABASE_PATH || env.DATABASE_PATH || './data/statsman.db';
}

export function usePostgres(): boolean {
	return getPostgresCandidates().length > 0;
}

export function getStripeConfig() {
	return {
		secretKey: env.STRIPE_SECRET_KEY || '',
		publishableKey: publicEnv.PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
		webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
		priceStarter: env.STRIPE_PRICE_STARTER || '',
		priceIndie: env.STRIPE_PRICE_INDIE || '',
		priceCreator: env.STRIPE_PRICE_CREATOR || ''
	};
}

export function getResendApiKey(): string | undefined {
	return env.RESEND_API_KEY || undefined;
}

export function getMailFrom(): string {
	return env.RESEND_MAIL_FROM || env.MAIL_FROM || 'Statsman <onboarding@resend.dev>';
}

/** Inbound contact address shown on /contact and where contact-form messages are delivered. */
export function getContactEmail(): string {
	return (env.RESEND_CONTACT_EMAIL || env.STATSMAN_CONTACT_EMAIL || env.CONTACT_EMAIL || 'hello@statsman.xyz').trim();
}

/**
 * Comma-separated emails that get the Founder plan on cloud (operator seats).
 * Example: STATSMAN_FOUNDER_EMAILS=you@domain.com,cofounder@domain.com
 */
export function getFounderEmails(): string[] {
	const raw = (env.STATSMAN_FOUNDER_EMAILS || '').trim();
	if (!raw) return [];
	return raw
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
}

export function isFounderEmail(email: string | null | undefined): boolean {
	if (!email) return false;
	const needle = email.trim().toLowerCase();
	return getFounderEmails().includes(needle);
}

/** Supabase Auth (cloud). Prefer SUPABASE_PUBLISHABLE_KEY; SUPABASE_ANON_KEY also works. */
export function getSupabaseUrl(): string {
	return (env.SUPABASE_URL || publicEnv.PUBLIC_SUPABASE_URL || '').trim();
}

export function getSupabaseAnonKey(): string {
	return (
		env.SUPABASE_PUBLISHABLE_KEY ||
		env.SUPABASE_ANON_KEY ||
		publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
		publicEnv.PUBLIC_SUPABASE_ANON_KEY ||
		''
	).trim();
}

export function getSupabaseServiceRoleKey(): string {
	return (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function supabaseAuthConfigured(): boolean {
	return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** OpenRouter — powers the AI Analyst (Explain + Ask). */
export function getOpenRouterApiKey(): string | undefined {
	return env.OPENROUTER_API_KEY || undefined;
}

export function getOpenRouterModel(): string {
	return (env.OPENROUTER_MODEL || 'openai/gpt-4o-mini').trim();
}

export function getOpenRouterBaseUrl(): string {
	return (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
}

export function aiConfigured(): boolean {
	return Boolean(getOpenRouterApiKey());
}
