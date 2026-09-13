import Stripe from 'stripe';
import { getPublicOrigin, getStripeConfig, isCloud, isFounderEmail } from '$lib/server/config';
import { isComplimentaryPlan } from '$lib/plans';
import { billingFlagOff, planFromStripePrice } from '$lib/server/plans';
import { getStore } from '$lib/server/db';

export type PaidPlan = 'starter' | 'indie' | 'creator';

const LIVE_STATUSES = new Set(['active', 'trialing']);
/** Do not touch local plan for these — Payment Element may still be open. */
const IGNORE_STATUSES = new Set(['incomplete', 'incomplete_expired', 'paused']);

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
	const price =
		plan === 'creator' ? cfg.priceCreator : plan === 'indie' ? cfg.priceIndie : cfg.priceStarter;
	if (!price) throw new Error(`Missing Stripe price for ${plan}`);
	return price;
}

async function clientSecretForSubscription(subscription: Stripe.Subscription) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	let sub = subscription;
	if (typeof sub.latest_invoice === 'string' || !sub.latest_invoice) {
		sub = await stripe.subscriptions.retrieve(sub.id, {
			expand: ['latest_invoice.confirmation_secret']
		});
	}

	const invoice = sub.latest_invoice;
	if (!invoice || typeof invoice === 'string') {
		throw new Error('Subscription invoice missing — check Stripe price config');
	}

	const clientSecret = invoice.confirmation_secret?.client_secret;
	if (!clientSecret) {
		throw new Error('Invoice confirmation_secret missing — cannot open Payment Element');
	}

	return { subscriptionId: sub.id, clientSecret };
}

async function hasLiveSubscription(customerId: string, stripe: Stripe) {
	const [active, trialing] = await Promise.all([
		stripe.subscriptions.list({
			customer: customerId,
			status: 'active',
			limit: 5,
			expand: ['data.items.data.price']
		}),
		stripe.subscriptions.list({
			customer: customerId,
			status: 'trialing',
			limit: 5,
			expand: ['data.items.data.price']
		})
	]);
	return [...active.data, ...trialing.data];
}

function subscriptionPriceId(item: Stripe.SubscriptionItem | undefined): string {
	if (!item?.price) return '';
	return typeof item.price === 'string' ? item.price : item.price.id;
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
	const raw = sub as unknown as { current_period_end?: number };
	if (typeof raw.current_period_end === 'number') return raw.current_period_end;
	const fromItem = sub.items?.data?.[0]?.current_period_end;
	return typeof fromItem === 'number' ? fromItem : null;
}

/** When the paid period actually ends (portal may set cancel_at OR cancel_at_period_end). */
function subscriptionAccessEndsAt(sub: Stripe.Subscription): number | null {
	if (typeof sub.cancel_at === 'number' && sub.cancel_at > 0) return sub.cancel_at;
	if (sub.cancel_at_period_end) return subscriptionPeriodEnd(sub);
	return null;
}

function isCancelScheduled(sub: Stripe.Subscription): boolean {
	return Boolean(sub.cancel_at_period_end) || (typeof sub.cancel_at === 'number' && sub.cancel_at > 0);
}

/** Stripe rejects cancel_at + cancel_at_period_end in the same update. */
function clearCancelUpdate(
	sub: Stripe.Subscription
): Pick<Stripe.SubscriptionUpdateParams, 'cancel_at' | 'cancel_at_period_end'> {
	if (typeof sub.cancel_at === 'number' && sub.cancel_at > 0) {
		return { cancel_at: '' };
	}
	if (sub.cancel_at_period_end) {
		return { cancel_at_period_end: false };
	}
	return {};
}

function planFromLiveSub(sub: Stripe.Subscription): string {
	return planFromStripePrice(subscriptionPriceId(sub.items.data[0]));
}

async function invoiceIsPaid(
	stripe: Stripe,
	invoiceRef: string | Stripe.Invoice | null | undefined
): Promise<{ paid: boolean; status: string | null }> {
	if (!invoiceRef) return { paid: false, status: null };
	const invoice =
		typeof invoiceRef === 'string' ? await stripe.invoices.retrieve(invoiceRef) : invoiceRef;

	const status = invoice.status ?? null;
	// Paid, or $0 invoice that does not need a charge.
	if (status === 'paid') return { paid: true, status };
	if ((invoice.amount_due ?? 0) <= 0 && status !== 'draft') {
		return { paid: true, status: status ?? 'zero' };
	}
	return { paid: false, status };
}

/**
 * Payment Element flow: create (or reuse) an incomplete subscription and
 * return the PaymentIntent client secret for checkout.
 */
export async function createSubscriptionPayment(userId: string, email: string, plan: PaidPlan) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const customerId = await ensureCustomer(userId, email);
	const price = priceForPlan(plan);

	const live = await hasLiveSubscription(customerId, stripe);
	if (live.length) {
		const same = live.find((s) => subscriptionPriceId(s.items.data[0]) === price);
		if (same) throw new Error('You are already on this plan');
		throw new Error('You already have a paid plan — open Billing to change it');
	}

	const incompletes = await stripe.subscriptions.list({
		customer: customerId,
		status: 'incomplete',
		limit: 10
	});

	const matching = incompletes.data.find(
		(s) => subscriptionPriceId(s.items.data[0]) === price
	);
	for (const sub of incompletes.data) {
		if (matching && sub.id === matching.id) continue;
		await stripe.subscriptions.cancel(sub.id).catch(() => undefined);
	}

	if (matching) {
		const secrets = await clientSecretForSubscription(matching);
		return { ...secrets, plan };
	}

	const subscription = await stripe.subscriptions.create({
		customer: customerId,
		items: [{ price }],
		payment_behavior: 'default_incomplete',
		payment_settings: { save_default_payment_method: 'on_subscription' },
		expand: ['latest_invoice.confirmation_secret'],
		metadata: { userId, plan }
	});

	const secrets = await clientSecretForSubscription(subscription);
	return { ...secrets, plan };
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
		return_url: `${getPublicOrigin()}/billing`
	});
}

export type CardSummary = {
	brand: string;
	last4: string;
	expMonth: number;
	expYear: number;
} | null;

/** SetupIntent for card update (Payment Element). */
export async function createBillingSetupIntent(userId: string, email: string) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');
	const customerId = await ensureCustomer(userId, email);
	const setupIntent = await stripe.setupIntents.create({
		customer: customerId,
		payment_method_types: ['card'],
		usage: 'off_session',
		metadata: { userId }
	});
	if (!setupIntent.client_secret) throw new Error('SetupIntent missing client_secret');
	return {
		clientSecret: setupIntent.client_secret,
		setupIntentId: setupIntent.id,
		customerId
	};
}

/** Attach PM as default on customer + all live subscriptions. */
export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');
	const store = await getStore();
	const user = await store.getUserById(userId);
	if (!user?.stripe_customer_id) throw new Error('No billing customer yet');

	const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
	const pmCustomer =
		typeof pm.customer === 'string' ? pm.customer : pm.customer && 'id' in pm.customer ? pm.customer.id : null;
	if (pmCustomer !== user.stripe_customer_id) {
		await stripe.paymentMethods.attach(paymentMethodId, { customer: user.stripe_customer_id });
	}

	await stripe.customers.update(user.stripe_customer_id, {
		invoice_settings: { default_payment_method: paymentMethodId }
	});

	const live = await hasLiveSubscription(user.stripe_customer_id, stripe);
	for (const sub of live) {
		await stripe.subscriptions.update(sub.id, {
			default_payment_method: paymentMethodId
		});
	}

	const card = pm.card
		? {
				brand: pm.card.brand,
				last4: pm.card.last4,
				expMonth: pm.card.exp_month,
				expYear: pm.card.exp_year
			}
		: null;

	return { ok: true as const, card };
}

export async function getCustomerCardSummary(customerId: string): Promise<CardSummary> {
	const stripe = getStripe();
	if (!stripe) return null;

	const customer = await stripe.customers.retrieve(customerId, {
		expand: ['invoice_settings.default_payment_method']
	});
	if (customer.deleted) return null;

	const def = customer.invoice_settings?.default_payment_method;
	let pm: Stripe.PaymentMethod | null = null;
	if (typeof def === 'string') {
		pm = await stripe.paymentMethods.retrieve(def);
	} else if (def && typeof def === 'object') {
		pm = def;
	}

	if (!pm?.card) {
		const live = await hasLiveSubscription(customerId, stripe);
		const subPm = live[0]?.default_payment_method;
		if (typeof subPm === 'string') {
			pm = await stripe.paymentMethods.retrieve(subPm);
		} else if (subPm && typeof subPm === 'object') {
			pm = subPm as Stripe.PaymentMethod;
		}
	}

	if (!pm?.card) return null;
	return {
		brand: pm.card.brand,
		last4: pm.card.last4,
		expMonth: pm.card.exp_month,
		expYear: pm.card.exp_year
	};
}

export type BillingSnapshot = {
	plan: string;
	subscriptionId: string | null;
	status: string | null;
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: number | null;
	/** Unix seconds when paid access ends, if a cancel is scheduled. */
	accessEndsAt: number | null;
	card: CardSummary;
	/** True when local DB was out of sync with Stripe and we corrected it. */
	reconciled: boolean;
};

/**
 * Trust Stripe as source of truth for paid status.
 * - Live sub (incl. scheduled cancel until that date) → keep paid plan
 * - No live sub (fully ended) → demote to free (covers portal cancels when webhooks missed)
 */
export async function reconcileUserPlanFromStripe(userId: string): Promise<BillingSnapshot> {
	const stripe = getStripe();
	const store = await getStore();
	const user = await store.getUserById(userId);
	if (!user) throw new Error('User not found');

	// Founder / complimentary seats are never demoted by Stripe sync.
	if (isFounderEmail(user.email) || isComplimentaryPlan(user.plan)) {
		if (isFounderEmail(user.email) && user.plan !== 'founder') {
			await store.setUserPlan(userId, 'founder');
			return {
				plan: 'founder',
				subscriptionId: null,
				status: null,
				cancelAtPeriodEnd: false,
				currentPeriodEnd: null,
				accessEndsAt: null,
				card: null,
				reconciled: true
			};
		}
		const card = user.stripe_customer_id
			? await getCustomerCardSummary(user.stripe_customer_id).catch(() => null)
			: null;
		return {
			plan: isFounderEmail(user.email) ? 'founder' : user.plan || 'free',
			subscriptionId: null,
			status: null,
			cancelAtPeriodEnd: false,
			currentPeriodEnd: null,
			accessEndsAt: null,
			card,
			reconciled: false
		};
	}

	const localPlan = user.plan || 'free';
	const card = user.stripe_customer_id
		? await getCustomerCardSummary(user.stripe_customer_id).catch(() => null)
		: null;
	const base: BillingSnapshot = {
		plan: localPlan,
		subscriptionId: null,
		status: null,
		cancelAtPeriodEnd: false,
		currentPeriodEnd: null,
		accessEndsAt: null,
		card,
		reconciled: false
	};

	if (!stripe || !user.stripe_customer_id) {
		if (localPlan !== 'free' && !isComplimentaryPlan(localPlan)) {
			await store.setUserPlan(userId, 'free');
			return { ...base, plan: 'free', reconciled: true };
		}
		return base;
	}

	const live = await hasLiveSubscription(user.stripe_customer_id, stripe);
	const listed = live[0];

	if (!listed) {
		if (localPlan !== 'free' && !isComplimentaryPlan(localPlan)) {
			await store.setUserPlan(userId, 'free');
			return { ...base, plan: 'free', status: 'canceled', reconciled: true };
		}
		return { ...base, status: 'canceled' };
	}

	// Retrieve so cancel_at / period fields are complete.
	const sub = await stripe.subscriptions.retrieve(listed.id, {
		expand: ['items.data.price']
	});

	const stripePlan = planFromLiveSub(sub);
	let reconciled = false;
	if (stripePlan !== localPlan) {
		await store.setUserPlan(userId, stripePlan);
		reconciled = true;
	}

	const periodEnd = subscriptionPeriodEnd(sub);
	return {
		plan: stripePlan,
		subscriptionId: sub.id,
		status: sub.status,
		cancelAtPeriodEnd: isCancelScheduled(sub),
		currentPeriodEnd: periodEnd,
		accessEndsAt: subscriptionAccessEndsAt(sub),
		card,
		reconciled
	};
}

export async function getBillingSnapshot(userId: string): Promise<BillingSnapshot> {
	return reconcileUserPlanFromStripe(userId);
}

/** Switch Indie ↔ Creator only after Stripe collects the prorated invoice. */
export async function changeSubscriptionPlan(userId: string, plan: PaidPlan) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const store = await getStore();
	const user = await store.getUserById(userId);
	if (!user?.stripe_customer_id) throw new Error('No billing customer yet');

	const live = await hasLiveSubscription(user.stripe_customer_id, stripe);
	if (!live.length) {
		await store.setUserPlan(userId, 'free');
		throw new Error('No active subscription — subscribe again from Billing or Pricing');
	}

	const sub = await stripe.subscriptions.retrieve(live[0].id, {
		expand: ['items.data.price']
	});
	const item = sub.items.data[0];
	if (!item) throw new Error('Subscription has no items');

	const targetPrice = priceForPlan(plan);
	const previousPriceId = subscriptionPriceId(item);
	if (!previousPriceId) throw new Error('Current subscription price missing');
	if (previousPriceId === targetPrice) throw new Error('You are already on this plan');

	let updated: Stripe.Subscription;
	try {
		updated = await stripe.subscriptions.update(sub.id, {
			items: [{ id: item.id, price: targetPrice }],
			proration_behavior: 'always_invoice',
			// Fail the update if payment cannot be completed — do not leave a half-applied change.
			payment_behavior: 'error_if_incomplete',
			...clearCancelUpdate(sub),
			metadata: { ...(sub.metadata ?? {}), userId, plan },
			expand: ['items.data.price', 'latest_invoice']
		});
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Stripe rejected the plan change (payment incomplete)';
		const snap = await reconcileUserPlanFromStripe(userId);
		throw new Error(`Payment did not go through — still on ${snap.plan}. ${message}`);
	}

	const newPriceId = subscriptionPriceId(updated.items.data[0]);
	const paid = await invoiceIsPaid(stripe, updated.latest_invoice);

	if (newPriceId !== targetPrice || !paid.paid) {
		// Roll Stripe back to the previous price; never advance local plan.
		await stripe.subscriptions
			.update(sub.id, {
				items: [{ id: updated.items.data[0]?.id ?? item.id, price: previousPriceId }],
				proration_behavior: 'none',
				metadata: { ...(sub.metadata ?? {}), userId, plan: planFromStripePrice(previousPriceId) }
			})
			.catch(() => undefined);

		await store.setUserPlan(userId, planFromStripePrice(previousPriceId));
		throw new Error(
			newPriceId !== targetPrice
				? `Stripe did not apply the new price (still ${newPriceId || 'unknown'}). Still on previous plan.`
				: `Payment for plan change did not succeed (invoice ${paid.status ?? 'unknown'}). Still on previous plan.`
		);
	}

	const nextPlan = planFromStripePrice(newPriceId);
	if (nextPlan !== plan) {
		throw new Error('Stripe price IDs in .env do not match Indie/Creator mapping');
	}

	await store.setUserPlan(userId, nextPlan);
	return {
		plan: nextPlan,
		subscriptionId: updated.id,
		status: updated.status,
		priceId: newPriceId,
		invoiceStatus: paid.status
	};
}

/** Cancel the live subscription and return the account to Free. */
export async function cancelSubscription(userId: string, opts?: { atPeriodEnd?: boolean }) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const store = await getStore();
	const user = await store.getUserById(userId);
	if (!user?.stripe_customer_id) throw new Error('No billing customer yet');

	const live = await hasLiveSubscription(user.stripe_customer_id, stripe);
	if (!live.length) {
		await store.setUserPlan(userId, 'free');
		return { plan: 'free' as const, status: 'canceled' as const };
	}

	const sub = live[0];
	const atPeriodEnd = opts?.atPeriodEnd === true;

	if (atPeriodEnd) {
		const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
		return {
			plan: user.plan || 'free',
			status: updated.status,
			cancelAtPeriodEnd: true,
			currentPeriodEnd: subscriptionPeriodEnd(updated),
			accessEndsAt: subscriptionAccessEndsAt(updated)
		};
	}

	await stripe.subscriptions.cancel(sub.id);
	await store.setUserPlan(userId, 'free');
	return { plan: 'free' as const, status: 'canceled' as const };
}

/** Undo a scheduled cancel (cancel_at_period_end and/or cancel_at). */
export async function resumeSubscription(userId: string) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');

	const store = await getStore();
	const user = await store.getUserById(userId);
	if (!user?.stripe_customer_id) throw new Error('No billing customer yet');

	const live = await hasLiveSubscription(user.stripe_customer_id, stripe);
	if (!live.length) throw new Error('No active subscription');

	const updated = await stripe.subscriptions.update(live[0].id, {
		...clearCancelUpdate(live[0]),
		expand: ['items.data.price']
	});
	const priceId = subscriptionPriceId(updated.items.data[0]);
	const plan = planFromStripePrice(priceId);
	if (plan !== 'free') await store.setUserPlan(userId, plan);
	return { plan, status: updated.status, cancelAtPeriodEnd: false };
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

export async function syncPlanFromSubscription(
	subscriptionId: string,
	opts?: { userId?: string }
) {
	const stripe = getStripe();
	if (!stripe) throw new Error('Stripe is not configured');
	const store = await getStore();
	const sub = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['items.data.price']
	});
	const customerId = String(sub.customer);
	const priceId = subscriptionPriceId(sub.items.data[0]);
	const user = await store.getUserByStripeCustomer(customerId);

	if (opts?.userId) {
		const expected = await store.getUserById(opts.userId);
		if (!expected?.stripe_customer_id || expected.stripe_customer_id !== customerId) {
			throw new Error('Subscription does not belong to this account');
		}
	}

	if (user && LIVE_STATUSES.has(sub.status)) {
		if (isFounderEmail(user.email) || isComplimentaryPlan(user.plan)) {
			return { plan: user.plan || 'founder', status: sub.status, userId: user.id, priceId };
		}
		const plan = planFromStripePrice(priceId);
		if (plan === 'free') {
			throw new Error(
				`Stripe price ${priceId || '(missing)'} does not match STRIPE_PRICE_STARTER / INDIE / CREATOR`
			);
		}
		await store.setUserPlan(user.id, plan);
		return { plan, status: sub.status, userId: user.id, priceId };
	}

	if (user && (sub.status === 'canceled' || sub.status === 'unpaid')) {
		if (isFounderEmail(user.email) || isComplimentaryPlan(user.plan)) {
			return { plan: user.plan || 'founder', status: sub.status, userId: user.id, priceId };
		}
		const live = await hasLiveSubscription(customerId, stripe);
		if (!live.length) {
			await store.setUserPlan(user.id, 'free');
			return { plan: 'free', status: sub.status, userId: user.id, priceId };
		}
	}

	return {
		plan: user?.plan ?? 'free',
		status: sub.status,
		userId: user?.id ?? null,
		priceId
	};
}

/**
 * subscription.updated/created must NOT promote plans — upgrades emit this
 * before payment succeeds and were flipping local UI to Creator while Stripe
 * stayed on Indie / rolled back. Promotions only via paid invoices.
 */
async function applySubscriptionLifecycle(sub: Stripe.Subscription) {
	const stripe = getStripe();
	if (!stripe) return;
	const store = await getStore();
	const customerId = String(sub.customer);
	const user = await store.getUserByStripeCustomer(customerId);
	if (!user) return;

	if (IGNORE_STATUSES.has(sub.status)) return;

	if (isFounderEmail(user.email) || isComplimentaryPlan(user.plan)) return;

	if (sub.status === 'canceled' || sub.status === 'unpaid') {
		const live = await hasLiveSubscription(customerId, stripe);
		if (!live.length) await store.setUserPlan(user.id, 'free');
		else {
			const priceId = subscriptionPriceId(live[0].items.data[0]);
			await store.setUserPlan(user.id, planFromStripePrice(priceId));
		}
	}
	// active/trialing: ignore here — wait for invoice.paid
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
	const parentSub = invoice.parent?.subscription_details?.subscription;
	if (typeof parentSub === 'string') return parentSub;
	if (parentSub && typeof parentSub === 'object' && 'id' in parentSub) {
		return String((parentSub as { id: string }).id);
	}
	// Legacy shape
	const legacy = (invoice as { subscription?: string | { id?: string } | null }).subscription;
	if (typeof legacy === 'string') return legacy;
	if (legacy && typeof legacy === 'object' && legacy.id) return legacy.id;
	return null;
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
	const stripe = getStripe();
	const { webhookSecret } = getStripeConfig();
	if (!stripe || !webhookSecret) throw new Error('Stripe webhook not configured');

	const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

	if (
		event.type === 'customer.subscription.created' ||
		event.type === 'customer.subscription.updated'
	) {
		await applySubscriptionLifecycle(event.data.object as Stripe.Subscription);
	}

	if (event.type === 'customer.subscription.deleted') {
		const sub = event.data.object as Stripe.Subscription;
		const customerId = String(sub.customer);
		const store = await getStore();
		const user = await store.getUserByStripeCustomer(customerId);
		if (user) {
			if (isFounderEmail(user.email) || isComplimentaryPlan(user.plan)) {
				/* keep founder */
			} else {
			const live = await hasLiveSubscription(customerId, stripe);
			if (!live.length) await store.setUserPlan(user.id, 'free');
			else {
				const priceId = subscriptionPriceId(live[0].items.data[0]);
				await store.setUserPlan(user.id, planFromStripePrice(priceId));
			}
			}
		}
	}

	// Promote / re-sync plan only after money cleared.
	if (
		event.type === 'invoice.paid' ||
		event.type === 'invoice.payment_succeeded' ||
		event.type === 'invoice_payment.paid'
	) {
		const invoice = event.data.object as Stripe.Invoice;
		const subId = subscriptionIdFromInvoice(invoice);
		if (subId) await syncPlanFromSubscription(subId);
	}

	return { received: true };
}

/** Cloud billing: beta → off; normal → need Stripe keys + all three prices. */
export function billingEnabled() {
	if (billingFlagOff()) return false;
	const cfg = getStripeConfig();
	return (
		isCloud() &&
		Boolean(cfg.secretKey && cfg.publishableKey && cfg.priceStarter && cfg.priceIndie && cfg.priceCreator)
	);
}

/** Missing pieces that will break live payments / renewals. Empty when ready or billing off. */
export function cloudBillingGaps(): string[] {
	if (!isCloud() || billingFlagOff()) return [];
	const cfg = getStripeConfig();
	const gaps: string[] = [];
	if (!cfg.secretKey) gaps.push('STRIPE_SECRET_KEY');
	if (!cfg.publishableKey) gaps.push('PUBLIC_STRIPE_PUBLISHABLE_KEY');
	if (!cfg.priceStarter) gaps.push('STRIPE_PRICE_STARTER');
	if (!cfg.priceIndie) gaps.push('STRIPE_PRICE_INDIE');
	if (!cfg.priceCreator) gaps.push('STRIPE_PRICE_CREATOR');
	if (!cfg.webhookSecret) gaps.push('STRIPE_WEBHOOK_SECRET');
	return gaps;
}
