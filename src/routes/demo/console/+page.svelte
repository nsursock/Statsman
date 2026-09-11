<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { enterShell, gsap } from '@scifiui/core/js';
	import ConsoleFrame from '$lib/components/ConsoleFrame.svelte';
	import MissionConsole from '$lib/components/MissionConsole.svelte';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let root: HTMLElement;
	let live = $state(true);
	let clock = $state('');

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

	function switchDays(days: number) {
		goto(`/demo/console?days=${days}`);
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
			<header class="command-bar sticky top-3 z-40 mb-5" data-enter>
				<div class="flex items-center gap-3 min-w-0">
					<a href="/" class="brand-mark text-base no-underline shrink-0">Statsman</a>
					<span class="badge badge-primary shrink-0">demo</span>
					<span class="status-chip hidden sm:inline-flex">
						<span class="dot"></span> public · no login
					</span>
					<span class="hidden md:inline text-[0.65rem] font-mono text-scifi-muted tracking-wider tabular-nums">
						{clock || '—:—:—'}
					</span>
				</div>
				<div class="flex items-center gap-2 flex-wrap justify-end">
					<button
						type="button"
						class="live-toggle {live ? 'is-live' : ''}"
						title="Toggle live refresh"
						onclick={() => (live = !live)}
					>
						<span class="live-dot"></span>
						{live ? 'LIVE' : 'PAUSED'}
					</button>
					<div class="range-seg" role="group" aria-label="Date range">
						{#each [1, 7, 30] as d}
							<button
								type="button"
								class="range-btn {data.days === d ? 'is-active' : ''}"
								onclick={() => switchDays(d)}
							>
								{d}d
							</button>
						{/each}
					</div>
					<ThemePicker compact />
					<a href="/demo" data-sveltekit-reload class="btn btn-xs btn-ghost">← Fake blog</a>
					<a href="/" class="btn btn-xs btn-ghost">Exit demo</a>
				</div>
			</header>
		{/snippet}

		<div class="space-y-4">
			<MissionConsole
				site={data.site}
				stats={data.stats}
				recentEvents={data.recentEvents}
				days={data.days}
				{live}
				kicker="// Ungated demo console"
				emptyStream="No events yet — open the fake blog and click around."
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
