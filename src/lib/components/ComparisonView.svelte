<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { Competitor } from '$lib/comparisons';

	let {
		competitor,
		demoAvailable,
		billingEnabled
	}: {
		competitor: Competitor;
		demoAvailable: boolean;
		billingEnabled: boolean;
	} = $props();

	const statsmanRow = $derived({
		name: 'Statsman',
		startingPrice: billingEnabled ? '$3/mo' : 'Free (beta)',
		selfHost: true,
		license: 'MIT',
		storage: 'SQLite / Postgres',
		trackerSize: '~1 KB',
		hasLiveDemo: true,
		aesthetic: 'ScifiUI console + 3D Earth globe',
		freeCloudTier: billingEnabled ? 'No (from $3/mo)' : 'Yes (beta)'
	});

	const rows: { label: string; statsman: string; competitor: string }[] = $derived([
		{ label: 'Starting price', statsman: statsmanRow.startingPrice, competitor: competitor.startingPrice },
		{ label: 'Self-host', statsman: 'Yes (Docker, free)', competitor: competitor.selfHost ? 'Yes' : 'No' },
		{ label: 'License', statsman: statsmanRow.license, competitor: competitor.license },
		{ label: 'Storage', statsman: statsmanRow.storage, competitor: competitor.storage },
		{ label: 'Tracker size', statsman: statsmanRow.trackerSize, competitor: competitor.trackerSize },
		{ label: 'Live demo', statsman: 'Yes — no signup', competitor: competitor.hasLiveDemo ? 'Yes' : 'No' },
		{ label: 'Aesthetic', statsman: statsmanRow.aesthetic, competitor: competitor.aesthetic },
		{ label: 'Free cloud tier', statsman: statsmanRow.freeCloudTier, competitor: competitor.freeCloudTier }
	]);
</script>

<svelte:head>
	<title>Statsman vs {competitor.name} — privacy analytics comparison</title>
	<meta name="description" content={competitor.metaDescription} />
</svelte:head>

<main class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)]">
	<header class="app-bar">
		<a href="/" class="brand-mark text-base no-underline text-[var(--scifi-text)]">Statsman</a>
		<div class="flex gap-2 items-center">
			<ThemePicker compact />
			<a class="btn btn-sm btn-ghost" href="/compare">All comparisons</a>
			{#if demoAvailable}
				<a class="btn btn-sm btn-primary" href="/demo/console">Try the demo</a>
			{:else}
				<a class="btn btn-sm btn-primary" href="/signup">Start free</a>
			{/if}
		</div>
	</header>

	<div class="mx-auto max-w-4xl px-4 py-10 space-y-10">
		<!-- Hero -->
		<section class="space-y-3">
			<p class="label-kicker text-scifi-primary">Comparison</p>
			<h1 class="hero-title text-4xl sm:text-5xl font-extrabold tracking-tight">
				Statsman <span class="text-scifi-muted">vs</span> {competitor.name}
			</h1>
			<p class="text-scifi-muted text-sm sm:text-base max-w-2xl leading-relaxed">
				{competitor.tagline}
			</p>
			<div class="flex flex-wrap gap-2 pt-2">
				{#if demoAvailable}
					<a href="/demo/console" class="btn btn-primary">Try the live demo →</a>
				{/if}
				<a href="/pricing" class="btn btn-ghost">View pricing</a>
				<a href="/self-host" class="btn btn-ghost">Self-host guide</a>
			</div>
		</section>

		<!-- Comparison table -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Feature comparison</span>
			</div>
			<div class="p-4 sm:p-5 overflow-x-auto">
				<table class="table-scifi">
					<thead>
						<tr>
							<th></th>
							<th class="text-scifi-primary">Statsman</th>
							<th>{competitor.name}</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row}
							<tr>
								<td class="text-scifi-muted">{row.label}</td>
								<td>{row.statsman}</td>
								<td>{row.competitor}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- Where Statsman wins -->
		<section class="space-y-4">
			<div>
				<p class="label-kicker text-scifi-cyan mb-2">Where Statsman wins</p>
				<h2 class="text-2xl font-extrabold tracking-tight">Why people switch to Statsman</h2>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each competitor.statsmanWins as point}
					<div class="pane pane-bracketed p-4">
						<p class="text-sm text-scifi-muted leading-relaxed m-0 flex gap-2">
							<span class="text-scifi-primary shrink-0">▸</span>
							<span>{point}</span>
						</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- Where competitor wins (honest) -->
		<section class="space-y-4">
			<div>
				<p class="label-kicker text-scifi-muted mb-2">Where {competitor.name} wins</p>
				<h2 class="text-2xl font-extrabold tracking-tight text-scifi-muted">
					We respect the competition
				</h2>
			</div>
			<div class="pane p-4 sm:p-5 space-y-2">
				{#each competitor.competitorWins as point}
					<p class="text-sm text-scifi-muted leading-relaxed m-0 flex gap-2">
						<span class="text-scifi-muted/60 shrink-0">▸</span>
						<span>{point}</span>
					</p>
				{/each}
			</div>
			<p class="text-xs text-scifi-muted/70 leading-relaxed max-w-2xl">
				{competitor.name} is a strong product. Statsman doesn't try to beat it on every feature —
				it wins on price, experience, and the joy of opening your dashboard every morning.
			</p>
		</section>

		<!-- CTA -->
		<section class="console-panel relative overflow-hidden p-6 sm:p-10 text-center">
			<div class="scan-line"></div>
			<div class="relative z-10 space-y-4">
				<p class="label-kicker text-scifi-primary m-0">// Ready to switch?</p>
				<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
					See it for yourself — no signup required
				</h2>
				<p class="text-scifi-muted text-sm max-w-lg mx-auto leading-relaxed">
					The live demo has 30 days of seeded traffic. Open the console, click around, and decide
					if Statsman is your next analytics home.
				</p>
				<div class="flex flex-wrap justify-center gap-3 pt-2">
					{#if demoAvailable}
						<a href="/demo/console" class="btn btn-primary">Try the live demo →</a>
					{/if}
					<a href="/signup" class="btn btn-ghost">
						{billingEnabled ? 'Sign up — from $3/mo' : 'Sign up — free beta'}
					</a>
					<a href="/self-host" class="btn btn-ghost">Self-host free</a>
				</div>
			</div>
		</section>

		<!-- Other comparisons -->
		<section class="space-y-3">
			<p class="label-kicker text-scifi-muted">Other comparisons</p>
			<div class="flex flex-wrap gap-2">
				<a href="/compare" class="btn btn-sm btn-ghost">All comparisons →</a>
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
