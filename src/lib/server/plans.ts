import { env } from '$env/dynamic/private';
import { type PlanId, planLimits, PLANS } from '$lib/plans';

export { planLimits, PLANS, type PlanId };

export function planFromStripePrice(priceId: string): PlanId {
	if (priceId && priceId === (env.STRIPE_PRICE_CREATOR || '')) return 'creator';
	if (priceId && priceId === (env.STRIPE_PRICE_INDIE || '')) return 'indie';
	return 'free';
}
