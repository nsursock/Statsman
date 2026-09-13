<script lang="ts">
	import { PLANS } from '$lib/plans';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const cloudPlans = [PLANS.free, PLANS.indie, PLANS.creator];

	function upgradeHref(plan: 'indie' | 'creator') {
		if (!data.user) return `/login?mode=signup&next=${encodeURIComponent(`/subscribe?plan=${plan}`)}`;
		const current = data.user.plan;
		if (current === 'indie' || current === 'creator') return '/billing';
		return `/subscribe?plan=${plan}&next=${encodeURIComponent(`/dashboard?billing=success&plan=${plan}`)}`;
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
			{#if data.billingEnabled}
				<h1 class="hero-title text-4xl font-extrabold">Simple pricing</h1>
				<p class="text-scifi-muted text-sm max-w-xl mx-auto">
					Hosted cloud with a honest free tier — or self-host forever for $0 on your own machine.
				</p>
			{:else}
				<h1 class="hero-title text-4xl font-extrabold">Free while we grow</h1>
				<p class="text-scifi-muted text-sm max-w-xl mx-auto">
					Cloud Statsman is free during beta — no cards, no plans. Self-host stays free forever on
					Docker.
				</p>
			{/if}
		</section>

		{#if data.billingEnabled}
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
						{:else}
							<a
								class="btn btn-primary w-full text-center"
								href={upgradeHref(plan.id === 'creator' ? 'creator' : 'indie')}
							>
								Upgrade
							</a>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="console-panel max-w-xl mx-auto">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Cloud beta</span>
					<span class="badge badge-primary">$0</span>
				</div>
				<div class="p-5 space-y-3 text-sm text-scifi-muted">
					<p class="m-0 text-[var(--scifi-text)]">
						Sign up with email and password, add your blogs, paste the tracker. No Stripe until we open
						paid plans.
					</p>
					<ul class="space-y-1 list-none p-0 m-0">
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> Practical unlimited sites &amp; views</li>
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> Same cookieless tracker as paid will use</li>
						<li class="flex gap-2"><span class="text-scifi-primary">▸</span> Self-host anytime if you want your own box</li>
					</ul>
					<a class="btn btn-primary w-full text-center" href="/signup">Start free →</a>
				</div>
			</div>
		{/if}

		<div class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Prefer self-host?</span>
			</div>
			<div class="p-4 text-sm text-scifi-muted space-y-3">
				<p class="m-0">
					Run anywhere Docker runs — Railway, a VPS, your lab. Cloud on the main site is optional
					convenience.
				</p>
				<pre class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto m-0">docker compose up -d --build</pre>
				<a class="btn btn-sm btn-primary inline-flex" href="/self-host">Self-host guide →</a>
			</div>
		</div>
	</div>
</main>
