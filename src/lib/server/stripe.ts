import Stripe from 'stripe';
import { getPublicOrigin, getStripeConfig, isCloud } from '$lib/server/config';
import { planFromStripePrice } from '$lib/server/plans';
import { getStore } from '$lib/server/db';

export type PaidPlan = 'indie' | 'creator';

export function getStripe(): Stripe | null {
	const { secretKey } = getStripeConfig();
	if (!secretKey) return null;
	return new Stripe(secretKey);
}

async function ensureCustomer(userId: string, email: string): Promise<string> {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const store = await getStore();
	const user = await store.getUserById(userId);
	if (!user) throw new Error('User not found');

	if (user.stripe_customer_id) return user.stripe_customer_id;

	const customer = await stripe.customers.create({ email, metadata: { userId } });
	await store.setStripeCustomerId(userId, customer.id);
	return customer.id;
}

function priceForPlan(plan: PaidPlan): string {
	const cfg = getStripeConfig();
	const price = plan === 'creator' ? cfg.priceCreator : cfg.priceIndie;
	if (!price) throw new Error(`Missing Stripe price for ${plan}`);
	return price;
}

/**
 * Native Payment Element flow: create an incomplete subscription and return
 * the PaymentIntent client secret so the card UI stays inside Statsman.
 */
export async function createSubscriptionPayment(userId: string, email: string, plan: PaidPlan) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const customerId = await ensureCustomer(userId, email);
	const price = priceForPlan(plan);

	const subscription = await stripe.subscriptions.create({
		customer: customerId,
		items: [{ price }],
		payment_behavior: 'default_incomplete',
		payment_settings: { save_default_payment_method: 'on_subscription' },
		expand: ['latest_invoice.confirmation_secret'],
		metadata: { userId, plan }
	});

	const invoice = subscription.latest_invoice;
	if (!invoice || typeof invoice === 'string') {
		throw new Error('Subscription invoice missing — check Stripe price config');
	}

	const clientSecret = invoice.confirmation_secret?.client_secret;
	if (!clientSecret) {
		throw new Error('Invoice confirmation_secret missing — cannot open Payment Element');
	}

	return {
		subscriptionId: subscription.id,
		clientSecret,
		plan
	};
}

/** @deprecated Prefer createSubscriptionPayment + native /subscribe UI. */
export async function createCheckoutSession(
	userId: string,
	email: string,
	plan: PaidPlan,
	opts?: { successPath?: string; cancelPath?: string }
) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const customerId = await ensureCustomer(userId, email);
	const price = priceForPlan(plan);
	const origin = getPublicOrigin();
	const successPath = opts?.successPath ?? '/dashboard?billing=success';
	const cancelPath = opts?.cancelPath ?? '/dashboard?billing=cancel';

	return stripe.checkout.sessions.create({
		mode: 'subscription',
		customer: customerId,
		line_items: [{ price, quantity: 1 }],
		success_url: `${origin}${successPath.startsWith('/') ? successPath : `/${successPath}`}`,
		cancel_url: `${origin}${cancelPath.startsWith('/') ? cancelPath : `/${cancelPath}`}`,
		metadata: { userId, plan }
	});
}

export async function createPortalSession(customerId: string) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');
	return stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: `${getPublicOrigin()}/dashboard`
	});
}

export async function getPaymentIntentStatus(paymentIntentId: string) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');
	const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
	return {
		id: pi.id,
		status: pi.status,
		metadata: pi.metadata
	};
}

export async function syncPlanFromSubscription(subscriptionId: string) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');
	const store = await getStore();
	const sub = await stripe.subscriptions.retrieve(subscriptionId);
	const customerId = String(sub.customer);
	const priceId = sub.items.data[0]?.price?.id ?? '';
	const plan =
		sub.status === 'active' || sub.status === 'trialing'
			? planFromStripePrice(priceId)
			: ((sub.metadata?.plan as string | undefined) ?? 'free');
	const user = await store.getUserByStripeCustomer(customerId);
	if (user && (sub.status === 'active' || sub.status === 'trialing')) {
		await store.setUserPlan(user.id, plan);
	}
	return { plan, status: sub.status, userId: user?.id ?? null };
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
	const stripe = getStripe();
	const { webhookSecret } = getStripeConfig();
	if (!stripe || !webhookSecret) throw new Error('Stripe webhook not configured');

	const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
	const store = await getStore();

	if (
		event.type === 'customer.subscription.created' ||
		event.type === 'customer.subscription.updated'
	) {
		const sub = event.data.object as Stripe.Subscription;
		const customerId = String(sub.customer);
		const priceId = sub.items.data[0]?.price?.id ?? '';
		const plan =
			sub.status === 'active' || sub.status === 'trialing'
				? planFromStripePrice(priceId)
				: 'free';
		const user = await store.getUserByStripeCustomer(customerId);
		if (user) await store.setUserPlan(user.id, plan);
	}

	if (event.type === 'customer.subscription.deleted') {
		const sub = event.data.object as Stripe.Subscription;
		const user = await store.getUserByStripeCustomer(String(sub.customer));
		if (user) await store.setUserPlan(user.id, 'free');
	}

	if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
		const invoice = event.data.object as Stripe.Invoice;
		const subRef = invoice.parent?.subscription_details?.subscription;
		const subId = typeof subRef === 'string' ? subRef : subRef?.id;
		if (subId) await syncPlanFromSubscription(subId);
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session;
		const userId = session.metadata?.userId;
		const plan = session.metadata?.plan;
		if (userId && plan) await store.setUserPlan(userId, plan);
	}

	return { received: true };
}

export function billingEnabled() {
	const cfg = getStripeConfig();
	return isCloud() && Boolean(cfg.secretKey && cfg.publishableKey);
}
