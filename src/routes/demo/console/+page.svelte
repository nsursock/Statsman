<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { enterShell, gsap } from '@scifiui/core/js';
	import ConsoleFrame from '$lib/components/ConsoleFrame.svelte';
	import MissionConsole from '$lib/components/MissionConsole.svelte';
	import AiAnalyst from '$lib/components/AiAnalyst.svelte';
	import DashboardNav from '$lib/components/DashboardNav.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let root: HTMLElement;
	let live = $state(true);
	let clock = $state('');
	let siteMenuOpen = $state(false);

	const sites = $derived([data.site]);

	$effect(() => {
		if (!browser || !live) return;
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') void invalidateAll();
		}, 2500);
		return () => clearInterval(id);
	});

	onMount(() => {
		enterShell(root);
		const tickClock = () => {
			clock = new Date().toLocaleTimeString('en-GB', { hour12: false });
		};
		tickClock();
		const clockId = setInterval(tickClock, 1000);

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!reduced) {
			gsap.from(root.querySelectorAll('[data-deck]'), {
				autoAlpha: 0,
				y: 16,
				duration: 0.55,
				stagger: 0.06,
				ease: 'power3.out',
				delay: 0.08
			});
			gsap.from(root.querySelectorAll('.meter-fill'), {
				scaleX: 0,
				transformOrigin: 'left center',
				duration: 0.85,
				stagger: 0.035,
				ease: 'power3.out',
				delay: 0.45
			});
		}

		return () => {
			clearInterval(clockId);
		};
	});

	function switchSite(_id: string) {
		/* Demo console is a single site. */
		siteMenuOpen = false;
	}

	function switchDays(days: number) {
		goto(`/demo/console?days=${days}&points=${data.points}&chart=${data.chart}`);
	}

	function switchPoints(points: number) {
		goto(`/demo/console?days=${data.days}&points=${points}&chart=${data.chart}`);
	}

	function switchChart(chart: 'line' | 'bars') {
		goto(`/demo/console?days=${data.days}&points=${data.points}&chart=${chart}`);
	}
</script>

<svelte:head>
	<title>Demo console — Statsman</title>
	<meta
		name="description"
		content="Live demo analytics — the same mission control UI, no login required."
	/>
</svelte:head>

<div bind:this={root}>
	<ConsoleFrame>
		{#snippet header()}
			<DashboardNav
				variant="demo"
				{sites}
				site={data.site}
				days={data.days}
				bind:live
				{clock}
				identityLabel="Try Statsman free"
				identityMeta="demo · no login"
				bind:siteMenuOpen
				onSwitchSite={switchSite}
				onSwitchDays={switchDays}
			/>
		{/snippet}

		<div class="space-y-4">
			<MissionConsole
				site={data.site}
				stats={data.stats}
				recentEvents={data.recentEvents}
				days={data.days}
				points={data.points}
				chart={data.chart}
				{live}
				kicker="// Ungated demo console"
				emptyStream="No events yet — open the fake blog and click around."
				onPointsChange={switchPoints}
				onChartChange={switchChart}
			/>

			<AiAnalyst
				siteId={data.site.id}
					siteName={data.site.name}
					days={data.days}
					aiAvailable={data.aiAvailable}
			/>

			<div class="cta-panel" data-deck>
				<div class="min-w-0">
					<p class="label-kicker text-scifi-primary m-0 mb-1">// Own this console</p>
					<p class="text-sm text-scifi-muted m-0 leading-relaxed">
						Same UI for your sites. Demo traffic stays separate from anything you track after signup.
					</p>
				</div>
				<div class="flex gap-2 shrink-0 flex-wrap">
					<a href="/signup" class="btn btn-primary">Sign up</a>
					<a href="/login" class="btn btn-ghost">Log in</a>
				</div>
			</div>
		</div>
	</ConsoleFrame>
</div>

<style>
	.cta-panel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.15rem;
		border-radius: 14px;
		border: 1px solid var(--scifi-border-accent);
		background: linear-gradient(
			145deg,
			rgba(var(--scifi-primary-rgb), 0.1),
			rgba(var(--scifi-surface-1-rgb), 0.7)
		);
		box-shadow: 0 16px 48px -24px rgba(var(--scifi-shadow-rgb), 0.45);
	}
</style>
