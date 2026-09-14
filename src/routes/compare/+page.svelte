<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Statsman vs the competition — privacy analytics comparison</title>
	<meta
		name="description"
		content="Compare Statsman to Plausible, Fathom, and Umami. Privacy-first, cookieless analytics from $3/mo with a ScifiUI console and free self-host."
	/>
</svelte:head>

<main class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)]">
	<header class="app-bar">
		<a href="/" class="brand-mark text-base no-underline text-[var(--scifi-text)]">Statsman</a>
		<div class="flex gap-2 items-center">
			<ThemePicker compact />
			{#if data.demoAvailable}
				<a class="btn btn-sm btn-primary" href="/demo/console">Try the demo</a>
			{:else}
				<a class="btn btn-sm btn-primary" href="/signup">Start free</a>
			{/if}
		</div>
	</header>

	<div class="mx-auto max-w-4xl px-4 py-10 space-y-10">
		<!-- Hero -->
		<section class="space-y-3">
			<p class="label-kicker text-scifi-primary">Compare</p>
			<h1 class="hero-title text-4xl sm:text-5xl font-extrabold tracking-tight">
				Statsman vs the <span class="text-scifi-primary glow-text">competition</span>
			</h1>
			<p class="text-scifi-muted text-sm sm:text-base max-w-2xl leading-relaxed">
				Privacy-first analytics is a crowded field. Here's how Statsman stacks up against the
				tools you're probably comparing right now — honestly, feature by feature.
			</p>
			{#if data.demoAvailable}
				<div class="pt-2">
					<a href="/demo/console" class="btn btn-primary">Try the live demo — no signup →</a>
				</div>
			{/if}
		</section>

		<!-- Competitor cards -->
		<div class="grid gap-4">
			{#each data.competitors as c (c.slug)}
				<a
					href="/vs/{c.slug}"
					class="pane pane-bracketed p-5 transition-transform duration-300 hover:-translate-y-0.5 no-underline group block"
				>
					<div class="flex items-baseline justify-between gap-4 mb-2">
						<div class="flex items-baseline gap-3">
							<span class="text-lg font-bold group-hover:text-scifi-primary transition-colors">
								Statsman vs {c.name}
							</span>
							<span class="text-xs text-scifi-muted">{c.startingPrice}</span>
						</div>
						<span class="text-scifi-cyan text-sm group-hover:text-scifi-primary transition-colors shrink-0">
							Compare →
						</span>
					</div>
					<p class="text-scifi-muted text-sm leading-relaxed m-0">{c.tagline}</p>
					<p class="text-xs text-scifi-cyan mt-2 m-0 flex gap-2">
						<span class="shrink-0">▸</span>
						<span>{c.statsmanWins}</span>
					</p>
				</a>
			{/each}
		</div>

		<!-- Quick comparison table -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> At a glance</span>
			</div>
			<div class="p-4 sm:p-5 overflow-x-auto">
				<table class="table-scifi">
					<thead>
						<tr>
							<th></th>
							<th class="text-scifi-primary">Statsman</th>
							<th>Plausible</th>
							<th>Fathom</th>
							<th>Umami</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="text-scifi-muted">Starting price</td>
							<td class="text-scifi-success">{data.billingEnabled ? '$3/mo' : 'Free beta'}</td>
							<td>$9/mo</td>
							<td>$15/mo</td>
							<td>Free / $20/mo</td>
						</tr>
						<tr>
							<td class="text-scifi-muted">Self-host</td>
							<td class="text-scifi-success">Yes (free)</td>
							<td>Yes (AGPL)</td>
							<td>No</td>
							<td>Yes (MIT)</td>
						</tr>
						<tr>
							<td class="text-scifi-muted">License</td>
							<td class="text-scifi-success">MIT</td>
							<td>AGPLv3</td>
							<td>Closed</td>
							<td>MIT</td>
						</tr>
						<tr>
							<td class="text-scifi-muted">Storage</td>
							<td>SQLite / Postgres</td>
							<td>ClickHouse</td>
							<td>Managed</td>
							<td>Postgres / MySQL</td>
						</tr>
						<tr>
							<td class="text-scifi-muted">Live demo</td>
							<td class="text-scifi-success">Yes — no signup</td>
							<td>No</td>
							<td>No</td>
							<td>No</td>
						</tr>
						<tr>
							<td class="text-scifi-muted">Aesthetic</td>
							<td>ScifiUI console</td>
							<td>Minimal</td>
							<td>Polished</td>
							<td>Functional</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- CTA -->
		<section class="console-panel relative overflow-hidden p-6 sm:p-10 text-center">
			<div class="scan-line"></div>
			<div class="relative z-10 space-y-4">
				<p class="label-kicker text-scifi-primary m-0">// See for yourself</p>
				<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
					Don't just read comparisons — try it
				</h2>
				<p class="text-scifi-muted text-sm max-w-lg mx-auto leading-relaxed">
					The live demo has 30 days of seeded traffic. Open the console, click around, and see
					why Statsman feels different.
				</p>
				<div class="flex flex-wrap justify-center gap-3 pt-2">
					{#if data.demoAvailable}
						<a href="/demo/console" class="btn btn-primary">Try the live demo →</a>
					{/if}
					<a href="/signup" class="btn btn-ghost">
						{data.billingEnabled ? 'Sign up — from $3/mo' : 'Sign up — free beta'}
					</a>
					<a href="/self-host" class="btn btn-ghost">Self-host free</a>
				</div>
			</div>
		</section>

		<p class="text-xs text-scifi-muted pb-8">
			<a href="/" class="text-scifi-cyan no-underline hover:text-scifi-primary">← Home</a>
			<span class="mx-2 opacity-40">·</span>
			<a href="/pricing" class="no-underline hover:text-scifi-primary">Pricing</a>
			<span class="mx-2 opacity-40">·</span>
			<a href="/self-host" class="no-underline hover:text-scifi-primary">Self-host</a>
		</p>
	</div>
</main>
