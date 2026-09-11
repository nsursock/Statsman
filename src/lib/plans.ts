export type PlanId = 'free' | 'indie' | 'creator' | 'selfhost';

export type Plan = {
	id: PlanId;
	label: string;
	priceMonthly: number;
	sites: number;
	pageviews: number;
	description: string;
};

export const PLANS: Record<PlanId, Plan> = {
	free: {
		id: 'free',
		label: 'Free',
		priceMonthly: 0,
		sites: 1,
		pageviews: 3_000,
		description: 'One site, enough to dogfood your blog.'
	},
	indie: {
		id: 'indie',
		label: 'Indie',
		priceMonthly: 9,
		sites: 3,
		pageviews: 100_000,
		description: 'A few blogs, real traffic headroom.'
	},
	creator: {
		id: 'creator',
		label: 'Creator',
		priceMonthly: 19,
		sites: 10,
		pageviews: 1_000_000,
		description: 'Multi-site indie stack without agency bloat.'
	},
	selfhost: {
		id: 'selfhost',
		label: 'Self-host',
		priceMonthly: 0,
		sites: 999,
		pageviews: 50_000_000,
		description: 'Run on your hardware. Unlimited for practical purposes.'
	}
};

export function planLimits(plan: string | null | undefined): Plan {
	if (plan && plan in PLANS) return PLANS[plan as PlanId];
	return PLANS.free;
}
