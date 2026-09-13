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
	let ready = $state(false);
	let busy = $state(false);
	let errorMsg = $state('');
	let bootMsg = $state('Initializing secure card channel…');

	onMount(() => {
		enterShell(root);
		const params = new URLSearchParams(window.location.search);
		if (params.get('setup_intent') || params.get('redirect_status')) {
			void finishRedirect(params);
			return;
		}
		void boot();
	});

	async function finishRedirect(params: URLSearchParams) {
		bootMsg = 'Confirming card…';
		if (params.get('redirect_status') === 'failed') {
			errorMsg = 'Card setup failed or was canceled.';
			bootMsg = '';
			void boot();
			return;
		}
		const setupIntentId = params.get('setup_intent');
		if (!data.publishableKey || !setupIntentId) {
			errorMsg = 'Missing setup confirmation.';
			bootMsg = '';
			void boot();
			return;
		}
		try {
			const s = await loadStripe(data.publishableKey);
			if (!s) throw new Error('Stripe.js failed to load');
			const clientSecret = params.get('setup_intent_client_secret');
			if (!clientSecret) throw new Error('Missing setup client secret');
			const { setupIntent, error } = await s.retrieveSetupIntent(clientSecret);
			if (error) throw error;
			const paymentMethodId =
				typeof setupIntent?.payment_method === 'string'
					? setupIntent.payment_method
					: setupIntent?.payment_method?.id;
			if (!paymentMethodId) throw new Error('No payment method on setup intent');
			const res = await fetch('/api/billing/payment-method', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ paymentMethodId })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not attach card');
			await goto('/billing?card=updated', { replaceState: true });
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Could not finish card setup';
			bootMsg = '';
			void boot();
		}
	}

	async function boot() {
		if (!data.publishableKey) {
			bootMsg = 'Billing is not configured on this instance.';
			return;
		}
		try {
			const res = await fetch('/api/billing/setup-intent', { method: 'POST' });
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not start card setup');

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
			errorMsg = err instanceof Error ? err.message : 'Card setup failed';
			bootMsg = '';
		}
	}

	async function submit(e: Event) {
		e.preventDefault();
		if (!stripe || !elements || !ready) return;
		busy = true;
		errorMsg = '';

		const returnUrl = new URL('/billing/payment-method', window.location.origin);
		returnUrl.searchParams.set('setup', '1');

		const { error, setupIntent } = await stripe.confirmSetup({
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
			errorMsg = error.message || 'Could not save card';
			busy = false;
			return;
		}

		const paymentMethodId =
			typeof setupIntent?.payment_method === 'string'
				? setupIntent.payment_method
				: setupIntent?.payment_method?.id;

		if (!paymentMethodId) {
			errorMsg = 'Setup succeeded but no payment method was returned';
			busy = false;
			return;
		}

		try {
			const res = await fetch('/api/billing/payment-method', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ paymentMethodId })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not attach card');
			await goto('/billing?card=updated');
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Could not attach card';
			busy = false;
		}
	}

	const cardLabel = $derived(
		data.card
			? `${data.card.brand.toUpperCase()} •••• ${data.card.last4} · ${String(data.card.expMonth).padStart(2, '0')}/${data.card.expYear}`
			: 'No card on file'
	);
</script>

<svelte:head>
	<title>Update card — Statsman</title>
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
				<p class="label-kicker text-scifi-primary mt-3 mb-1">// Payment method</p>
				<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
					Update <span class="text-scifi-primary glow-text">card</span>
				</h1>
			</div>
			<a href="/billing" class="btn btn-sm btn-ghost">← Billing</a>
		</header>

		<div class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" data-enter>
			<aside class="console-panel h-fit">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> On file</span>
					<span class="badge badge-primary">{data.plan}</span>
				</div>
				<div class="p-5 space-y-4">
					<p class="text-sm text-scifi-muted m-0 leading-relaxed">
						Replace the default card used for Indie / Creator renewals.
					</p>
					<div class="glass rounded-lg p-3 text-sm">
						<p class="m-0 text-xs uppercase tracking-[0.14em] text-scifi-muted mb-1">Current</p>
						<p class="m-0 font-bold text-scifi-cyan">{cardLabel}</p>
					</div>
					<div class="glass rounded-lg p-3 text-xs text-scifi-muted">
						Billed to <span class="text-scifi-cyan">{data.user.email}</span>
					</div>
				</div>
			</aside>

			<section class="console-panel">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> New card</span>
					<span class="status-chip"><span class="dot"></span> encrypted</span>
				</div>
				<form class="p-5 space-y-4" onsubmit={submit}>
					{#if bootMsg}
						<p class="text-scifi-muted text-sm m-0">{bootMsg}</p>
					{/if}

					<div
						bind:this={mountEl}
						class="min-h-40 {ready ? '' : 'opacity-40 pointer-events-none'}"
						aria-label="Card details"
					></div>

					{#if errorMsg}
						<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
					{/if}

					<button class="btn-cta w-full" type="submit" disabled={!ready || busy}>
						{busy ? 'Saving…' : 'Save payment method'}
					</button>
					<p class="text-[0.68rem] tracking-[0.1em] uppercase text-scifi-muted/70 m-0 text-center">
						Secured by Stripe · card never touches our servers
					</p>
				</form>
			</section>
		</div>
	</div>
</main>
