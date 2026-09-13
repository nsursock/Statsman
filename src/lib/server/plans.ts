import { env } from '$env/dynamic/private';
import { type Plan, type PlanId, planLimits, PLANS } from '$lib/plans';

export { planLimits, PLANS, type PlanId };

export type BillingMode = 'beta' | 'normal';

/**
 * The billing tier, from `STATSMAN_BILLING`:
 *  - `beta`   → cloud is free, one plan with free-tier limits (1 site, 3k views). Selfhost is always free.
 *  - `normal` → Starter ($3) / Indie ($9) / Creator ($19) plans via Stripe (keys + prices required).
 *
 * `beta` is the default (any unset / unrecognized value falls back to beta).
 * `on` / `off` / `1` / `0` / `true` / `false` still work as aliases for backward compat.
 */
export function billingMode(): BillingMode {
	const raw = (env.STATSMAN_BILLING || '').trim().toLowerCase();
	if (raw === 'normal' || raw === 'on' || raw === '1' || raw === 'true') return 'normal';
	return 'beta';
}

/** True when running in free beta mode (no paid plans, no Stripe UI/caps). */
export function billingFlagOff(): boolean {
	return billingMode() === 'beta';
}

/**
 * Limits enforced on cloud ingest / site creation.
 * During beta everyone gets Starter limits (1 site, 3k views) for free.
 * In normal mode, 'free' = 0 sites (no subscription) — must subscribe to create sites.
 */
export function effectiveCloudLimits(plan: string | null | undefined): Plan {
	if (billingFlagOff()) return PLANS.starter;
	return planLimits(plan);
}

export function planFromStripePrice(priceId: string): PlanId {
	if (priceId && priceId === (env.STRIPE_PRICE_STARTER || '')) return 'starter';
	if (priceId && priceId === (env.STRIPE_PRICE_CREATOR || '')) return 'creator';
	if (priceId && priceId === (env.STRIPE_PRICE_INDIE || '')) return 'indie';
	return 'free';
}
