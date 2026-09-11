<script lang="ts">
	import { PLANS } from '$lib/plans';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const cloudPlans = [PLANS.free, PLANS.indie, PLANS.creator];

	function upgradeHref(plan: 'indie' | 'creator') {
		if (!data.user) return `/login?mode=signup&next=${encodeURIComponent(`/subscribe?plan=${plan}`)}`;
		return `/subscribe?plan=${plan}&next=${encodeURIComponent('/dashboard?billing=success')}`;
	}
</script>

<main class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)]">
	<header class="app-bar">
		<a href="/" class="brand-mark text-base no-underline text-[var(--scifi-text)]">Statsman</a>
		<div class="flex gap-2 items-center">
			<ThemePicker compact />
			<a class="btn btn-sm btn-ghost" href="/dashboard">Dashboard</a>
			<a class="btn btn-sm btn-primary" href="/signup">Start free</a>
		</div>
	</header>

	<div class="mx-auto max-w-5xl px-4 py-10 space-y-8">
		<section class="text-center space-y-3">
			<p class="label-kicker text-scifi-primary">Made for indie blogs</p>
			<h1 class="hero-title text-4xl font-extrabold">Simple pricing</h1>
			<p class="text-scifi-muted text-sm max-w-xl mx-auto">
				Hosted cloud with a honest free tier — or self-host forever for $0 on your own machine.
				Paid plans check out inside Statsman, not on a Stripe-branded page.
			</p>
		</section>

		<div class="grid gap-3 md:grid-cols-3">
			{#each cloudPlans as plan}
				<div class="pane pane-bracketed p-5 flex flex-col gap-3">
					<p class="label-kicker">{plan.label}</p>
					<p class="card-value text-3xl">
						{#if plan.priceMonthly === 0}
							$0
						{:else}
							${plan.priceMonthly}<span class="text-sm text-scifi-muted">/mo</span>
						{/if}
					</p>
					<p class="text-scifi-muted text-sm flex-1">{plan.description}</p>
					<ul class="text-sm space-y-1 text-scifi-muted">
						<li>{plan.sites} site{plan.sites === 1 ? '' : 's'}</li>
						<li>{plan.pageviews.toLocaleString()} pageviews / mo</li>
						<li>Cookieless tracker</li>
					</ul>
					{#if plan.id === 'free'}
						<a class="btn btn-primary w-full text-center" href="/signup">Start free</a>
					{:else if data.billingEnabled}
						<a
							class="btn btn-primary w-full text-center"
							href={upgradeHref(plan.id === 'creator' ? 'creator' : 'indie')}
						>
							Upgrade
						</a>
					{:else}
						<a class="btn btn-ghost w-full text-center" href="/login">Sign in to upgrade</a>
					{/if}
				</div>
			{/each}
		</div>

		<div class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Prefer self-host?</span>
			</div>
			<div class="p-4 text-sm text-scifi-muted space-y-2">
				<p>
					Run the MIT core with Docker Compose. Unlimited practical usage on your hardware — cloud sells
					convenience, not the analytics.
				</p>
				<pre class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto">docker compose up -d</pre>
			</div>
		</div>
	</div>
</main>
