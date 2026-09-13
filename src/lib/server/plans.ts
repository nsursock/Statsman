import { env } from '$env/dynamic/private';
import { type Plan, type PlanId, planLimits, PLANS } from '$lib/plans';

export { planLimits, PLANS, type PlanId };

/** Explicit kill switch — free cloud beta until you turn Stripe on. */
export function billingFlagOff(): boolean {
	const raw = (env.STATSMAN_BILLING || '').trim().toLowerCase();
	return raw === 'off' || raw === '0' || raw === 'false';
}

/**
 * Limits enforced on cloud ingest / site creation.
 * During free beta (`STATSMAN_BILLING=off`) everyone gets practical-unlimited Founder limits.
 */
export function effectiveCloudLimits(plan: string | null | undefined): Plan {
	if (billingFlagOff()) return PLANS.founder;
	return planLimits(plan);
}

export function planFromStripePrice(priceId: string): PlanId {
	if (priceId && priceId === (env.STRIPE_PRICE_CREATOR || '')) return 'creator';
	if (priceId && priceId === (env.STRIPE_PRICE_INDIE || '')) return 'indie';
	return 'free';
}
