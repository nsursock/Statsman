<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { enterShell } from '@scifiui/core/js';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import { PLANS } from '$lib/plans';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let root: HTMLElement;
	let busy = $state<string | null>(null);
	let errorMsg = $state('');
	let statusMsg = $state('');

	onMount(() => {
		enterShell(root);
		const params = new URLSearchParams(window.location.search);
		if (params.get('card') === 'updated') {
			statusMsg = 'Payment method updated.';
			const url = new URL(window.location.href);
			url.searchParams.delete('card');
			history.replaceState({}, '', url.pathname + url.search);
		}
	});

	const plan = $derived(data.snapshot.plan || 'free');
	const periodEndLabel = $derived.by(() => {
		const ts = data.snapshot.accessEndsAt ?? data.snapshot.currentPeriodEnd;
		if (!ts) return null;
		return new Date(ts * 1000).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	});

	async function changePlan(next: 'starter' | 'indie' | 'creator') {
		busy = next;
		errorMsg = '';
		statusMsg = '';
		try {
			const res = await fetch('/api/billing/change-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: next })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not change plan');
			// Only celebrate after server confirms Stripe payment + price.
			if (payload.plan !== next) {
				throw new Error(
					`Stripe is still on ${payload.plan ?? 'unknown'} — UI not updated.`
				);
			}
			statusMsg = `Switched to ${PLANS[next].label}.`;
			await invalidateAll();
			await goto(`/dashboard?billing=success&plan=${next}`);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Could not change plan';
			await invalidateAll();
		} finally {
			busy = null;
		}
	}

	async function cancel(atPeriodEnd: boolean) {
		busy = atPeriodEnd ? 'cancel-end' : 'cancel-now';
		errorMsg = '';
		statusMsg = '';
		try {
			const res = await fetch('/api/billing/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'cancel', atPeriodEnd })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not cancel');
			await invalidateAll();
			if (atPeriodEnd) {
				statusMsg = 'Cancellation scheduled at period end.';
			} else {
				await goto('/dashboard?billing=canceled');
				return;
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Could not cancel';
		} finally {
			busy = null;
		}
	}

	async function resume() {
		busy = 'resume';
		errorMsg = '';
		statusMsg = '';
		try {
			const res = await fetch('/api/billing/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'resume' })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not resume');
			statusMsg = 'Subscription resumed.';
			await invalidateAll();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Could not resume';
		} finally {
			busy = null;
		}
	}

</script>

<svelte:head>
	<title>Billing — Statsman</title>
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
				<p class="label-kicker text-scifi-primary mt-3 mb-1">// Billing</p>
				<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
					Manage <span class="text-scifi-primary glow-text">plan</span>
				</h1>
			</div>
			<a href="/dashboard" class="btn btn-sm btn-ghost">← Dashboard</a>
		</header>

		<div class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" data-enter>
			<aside class="console-panel h-fit">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Current</span>
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
						<li class="flex gap-2">
							<span class="text-scifi-primary">▸</span>
							{data.planMeta.sites} sites
						</li>
						<li class="flex gap-2">
							<span class="text-scifi-primary">▸</span>
							{data.planMeta.pageviews.toLocaleString()} pageviews / mo
						</li>
						{#if data.snapshot.status}
							<li class="flex gap-2">
								<span class="text-scifi-primary">▸</span>
								Status · {data.snapshot.status}
							</li>
						{/if}
						{#if data.snapshot.cancelAtPeriodEnd}
							<li class="flex gap-2 text-[var(--scifi-warning)]">
								<span>▸</span>
								{#if periodEndLabel}
									Paid access through {periodEndLabel}, then Free
								{:else}
									Cancellation scheduled at period end
								{/if}
							</li>
						{/if}
					</ul>
					<div class="glass rounded-lg p-3 text-xs text-scifi-muted">
						Billed to <span class="text-scifi-cyan">{data.user.email}</span>
					</div>
				</div>
			</aside>

			<section class="console-panel">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Change plan</span>
					<span class="status-chip"><span class="dot"></span> live</span>
				</div>
				<div class="p-5 space-y-4">
					{#if !data.billingEnabled}
						<p class="text-scifi-muted text-sm m-0">Billing is not configured on this instance.</p>
					{:else if plan === 'free'}
						{#if data.snapshot.reconciled}
							<p class="text-sm text-[var(--scifi-warning)] m-0">
								No active subscription. Subscribe to a plan to start tracking.
							</p>
						{:else}
							<p class="text-sm text-scifi-muted m-0">No subscription yet. Pick a plan to start.</p>
						{/if}
						<div class="flex flex-wrap gap-2">
							<a class="btn btn-primary" href="/subscribe?plan=starter">Starter $3</a>
							<a class="btn btn-ghost" href="/subscribe?plan=indie">Indie $9</a>
							<a class="btn btn-ghost" href="/subscribe?plan=creator">Creator $19</a>
						</div>
					{:else}
						{#if data.snapshot.cancelAtPeriodEnd}
							<div class="glass rounded-lg p-3 text-sm space-y-2">
								<p class="m-0 text-[var(--scifi-warning)]">
									Cancellation scheduled
									{#if periodEndLabel}
										· you keep <strong class="text-[var(--scifi-text)]">{data.planMeta.label}</strong> until
										{periodEndLabel}
									{/if}
								</p>
								<p class="m-0 text-xs text-scifi-muted">
									Upgrade/downgrade still works until then. “Keep subscription” undoes the cancel.
								</p>
								<button
									type="button"
									class="btn btn-primary btn-sm"
									disabled={busy !== null}
									onclick={resume}
								>
									{busy === 'resume' ? 'Resuming…' : 'Keep subscription'}
								</button>
							</div>
						{/if}

						<div class="space-y-3">
							{#each [data.plans.starter, data.plans.indie, data.plans.creator] as p (p.id)}
								{@const current = plan === p.id}
								<div
									class="glass rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 {current
										? 'ring-1 ring-[rgba(var(--scifi-primary-rgb),0.35)]'
										: ''}"
								>
									<div>
										<p class="m-0 font-bold">
											{p.label}
											<span class="text-scifi-muted font-normal">· ${p.priceMonthly}/mo</span>
										</p>
										<p class="m-0 text-xs text-scifi-muted mt-1">
											{p.sites} sites · {p.pageviews.toLocaleString()} views
										</p>
									</div>
									{#if current}
										<span class="badge badge-primary">Current</span>
									{:else}
										<button
											type="button"
											class="btn btn-primary btn-sm"
											disabled={busy !== null}
											onclick={() => changePlan(p.id as 'starter' | 'indie' | 'creator')}
										>
											{busy === p.id
												? 'Updating…'
												: p.priceMonthly > data.planMeta.priceMonthly
													? `Upgrade · $${p.priceMonthly}`
													: `Downgrade · $${p.priceMonthly}`}
										</button>
									{/if}
								</div>
							{/each}
						</div>

						<div class="border-t border-[var(--scifi-border)] pt-4 space-y-3">
							<p class="text-xs uppercase tracking-[0.14em] text-scifi-muted m-0">Cancel subscription</p>
							{#if data.snapshot.cancelAtPeriodEnd}
								<p class="text-sm text-scifi-muted m-0">
									Already scheduled{periodEndLabel ? ` for ${periodEndLabel}` : ' at period end'}. Use Keep
									subscription above to undo.
								</p>
							{:else}
								<div class="flex flex-wrap gap-2">
									<button
										type="button"
										class="btn btn-ghost btn-sm"
										disabled={busy !== null}
										onclick={() => cancel(true)}
									>
										{busy === 'cancel-end' ? 'Scheduling…' : 'Cancel at period end'}
									</button>
									<button
										type="button"
										class="btn btn-ghost btn-sm"
										disabled={busy !== null}
										onclick={() => cancel(false)}
									>
										{busy === 'cancel-now' ? 'Canceling…' : 'Cancel now → Free'}
									</button>
								</div>
							{/if}
						</div>

						<div class="border-t border-[var(--scifi-border)] pt-4">
							<p class="text-xs uppercase tracking-[0.14em] text-scifi-muted m-0 mb-2">Payment method</p>
							{#if data.snapshot.card}
								<p class="text-sm m-0 mb-2">
									<span class="text-scifi-cyan font-bold uppercase">{data.snapshot.card.brand}</span>
									•••• {data.snapshot.card.last4}
									<span class="text-scifi-muted text-xs ml-1">
										{String(data.snapshot.card.expMonth).padStart(2, '0')}/{data.snapshot.card.expYear}
									</span>
								</p>
							{/if}
							<a class="btn btn-ghost btn-sm" href="/billing/payment-method">Update card</a>
						</div>
					{/if}

					{#if statusMsg}
						<p class="text-sm text-scifi-success m-0">{statusMsg}</p>
					{/if}
					{#if errorMsg}
						<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
					{/if}
				</div>
			</section>
		</div>
	</div>
</main>
