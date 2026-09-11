<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enterShell } from '@scifiui/core/js';
	import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import { scifiStripeAppearance } from '$lib/stripe-appearance';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let root: HTMLElement;
	let mountEl: HTMLDivElement;
	let stripe = $state<Stripe | null>(null);
	let elements = $state<StripeElements | null>(null);
	let subscriptionId = $state<string | null>(null);
	let ready = $state(false);
	let busy = $state(false);
	let errorMsg = $state('');
	let bootMsg = $state('Initializing secure payment channel…');

	onMount(() => {
		enterShell(root);
		void boot();
	});

	async function boot() {
		if (!data.billingEnabled || !data.publishableKey) {
			bootMsg = 'Billing is not configured on this instance.';
			return;
		}

		try {
			const res = await fetch('/api/billing/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: data.plan })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not start subscription');

			subscriptionId = payload.subscriptionId;
			const s = await loadStripe(data.publishableKey);
			if (!s) throw new Error('Stripe.js failed to load');
			stripe = s;

			const appearance = scifiStripeAppearance();
			const els = s.elements({
				clientSecret: payload.clientSecret,
				appearance,
				loader: 'auto'
			});
			elements = els;

			const payment = els.create('payment', {
				layout: { type: 'tabs', defaultCollapsed: false }
			});
			payment.mount(mountEl);
			ready = true;
			bootMsg = '';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Payment setup failed';
			bootMsg = '';
		}
	}

	async function submit(e: Event) {
		e.preventDefault();
		if (!stripe || !elements || !ready) return;
		busy = true;
		errorMsg = '';

		const returnUrl = new URL('/subscribe/complete', window.location.origin);
		returnUrl.searchParams.set('plan', data.plan);
		returnUrl.searchParams.set('next', data.next);
		if (subscriptionId) returnUrl.searchParams.set('subscription_id', subscriptionId);

		const { error } = await stripe.confirmPayment({
			elements,
			confirmParams: {
				return_url: returnUrl.toString(),
				payment_method_data: {
					billing_details: { email: data.user.email }
				}
			},
			redirect: 'if_required'
		});

		if (error) {
			errorMsg = error.message || 'Payment failed';
			busy = false;
			return;
		}

		// Payment completed without redirect (e.g. card that does not need 3DS).
		try {
			await fetch('/api/billing/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscriptionId,
					plan: data.plan
				})
			});
		} catch {
			/* webhook will catch up */
		}
		await goto(data.next.startsWith('/') ? data.next : `/${data.next}`);
	}
</script>

<svelte:head>
	<title>Subscribe · {data.planMeta.label} — Statsman</title>
</svelte:head>

<main
	bind:this={root}
	class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)] relative overflow-x-hidden"
>
	<div class="absolute top-4 right-4 z-20">
		<ThemePicker compact />
	</div>

	<div class="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:py-14">
		<header class="mb-8 flex items-center justify-between gap-4 flex-wrap" data-enter>
			<div>
				<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
				<p class="label-kicker text-scifi-primary mt-3 mb-1">// Native checkout</p>
				<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
					Upgrade to <span class="text-scifi-primary glow-text">{data.planMeta.label}</span>
				</h1>
			</div>
			<a href="/pricing" class="btn btn-sm btn-ghost">← Back</a>
		</header>

		<div class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" data-enter>
			<!-- Order summary -->
			<aside class="console-panel h-fit">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Order</span>
					<span class="badge badge-primary">{data.planMeta.label}</span>
				</div>
				<div class="p-5 space-y-4">
					<div>
						<p class="card-value text-4xl mb-1">
							${data.planMeta.priceMonthly}<span class="text-sm text-scifi-muted font-normal">/mo</span>
						</p>
						<p class="text-scifi-muted text-sm m-0 leading-relaxed">{data.planMeta.description}</p>
					</div>
					<ul class="space-y-2 text-sm list-none p-0 m-0 text-scifi-muted">
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> {data.planMeta.sites} sites</li>
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> {data.planMeta.pageviews.toLocaleString()} pageviews / mo</li>
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> Cookieless tracker · over-cap stays green</li>
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> Cancel anytime from the portal</li>
					</ul>
					<div class="glass rounded-lg p-3 text-xs text-scifi-muted">
						Billed to <span class="text-scifi-cyan">{data.user.email}</span>
					</div>
				</div>
			</aside>

			<!-- Payment -->
			<section class="console-panel">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Payment</span>
					<span class="status-chip"><span class="dot"></span> encrypted</span>
				</div>
				<form class="p-5 space-y-4" onsubmit={submit}>
					{#if bootMsg}
						<p class="text-scifi-muted text-sm m-0">{bootMsg}</p>
					{/if}

					<div
						bind:this={mountEl}
						class="min-h-40 {ready ? '' : 'opacity-40 pointer-events-none'}"
						aria-label="Payment details"
					></div>

					{#if errorMsg}
						<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
					{/if}

					{#if data.billingEnabled}
						<button class="btn-cta w-full" type="submit" disabled={!ready || busy}>
							{busy ? 'Confirming…' : `Subscribe · $${data.planMeta.priceMonthly}/mo`}
						</button>
						<p class="text-[0.68rem] tracking-[0.1em] uppercase text-scifi-muted/70 m-0 text-center">
							Secured by Stripe · UI is Statsman · card never touches our servers
						</p>
					{:else}
						<p class="text-scifi-muted text-sm m-0">
							Set <code class="text-scifi-cyan">PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and
							<code class="text-scifi-cyan">STRIPE_SECRET_KEY</code> to enable native checkout.
						</p>
						<a class="btn btn-ghost w-full text-center" href="/pricing">Back to pricing</a>
					{/if}
				</form>
			</section>
		</div>
	</div>
</main>
