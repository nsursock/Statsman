<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { enterShell, gsap } from '@scifiui/core/js';
	import ConsoleFrame from '$lib/components/ConsoleFrame.svelte';
	import MissionConsole from '$lib/components/MissionConsole.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let domain = $state('');
	let creating = $state(false);
	let deletingId = $state<string | null>(null);
	let pendingDelete = $state<{ id: string; name: string } | null>(null);
	let message = $state('');
	let origin = $state('https://YOUR_HOST');
	let root: HTMLElement;
	let polling = $state(false);
	let live = $state(false);
	let copied = $state(false);
	let showOnboarding = $state(false);
	let settingsOpen = $state(false);
	let settingsTab = $state<'sites' | 'tracker' | 'appearance' | 'demo' | 'account'>('sites');
	let siteMenuOpen = $state(false);
	let siteMenuRoot: HTMLElement | undefined = $state();
	let clock = $state('');

	const identityLabel = $derived(
		data.user?.email ?? (data.isCloud ? 'Signed in' : 'Self-host operator')
	);
	const identityMeta = $derived(
		data.user ? `plan · ${data.user.plan ?? 'free'}` : data.isCloud ? 'cloud' : 'local console'
	);

	$effect(() => {
		showOnboarding = data.needsOnboarding;
	});

	$effect(() => {
		if (data.hasEvents) polling = false;
	});

	// Live refresh — $effect rebinds when `live` toggles (onMount closures go stale).
	$effect(() => {
		if (!browser || !live) return;
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') void invalidateAll();
		}, 2500);
		return () => clearInterval(id);
	});

	onMount(() => {
		origin = window.location.origin;
		enterShell(root);
		live = data.isDev;

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

		const timers: ReturnType<typeof setInterval>[] = [clockId];
		if (data.site && !data.hasEvents) {
			polling = true;
			timers.push(setInterval(() => invalidateAll(), 4000));
		}

		const onDoc = (e: MouseEvent) => {
			if (siteMenuRoot && !siteMenuRoot.contains(e.target as Node)) siteMenuOpen = false;
		};
		window.addEventListener('keydown', onKey);
		document.addEventListener('click', onDoc);
		return () => {
			timers.forEach(clearInterval);
			window.removeEventListener('keydown', onKey);
			document.removeEventListener('click', onDoc);
		};
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			openSettings('sites');
			return;
		}
		if (e.key !== 'Escape') return;
		if (pendingDelete) {
			cancelRemoveSite();
			return;
		}
		if (siteMenuOpen) {
			siteMenuOpen = false;
			return;
		}
		if (settingsOpen) settingsOpen = false;
	}

	function openSettings(tab: typeof settingsTab = 'sites') {
		siteMenuOpen = false;
		settingsTab = tab;
		settingsOpen = true;
	}

	async function createSite(e: Event) {
		e.preventDefault();
		creating = true;
		message = '';
		try {
			const res = await fetch('/api/sites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, domain })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Failed to create site');
			name = '';
			domain = '';
			await invalidateAll();
			await goto(
				`/dashboard?site=${payload.site.id}&days=${data.days}&points=${data.points}&chart=${data.chart}`
			);
			message = 'Site online.';
			settingsTab = 'tracker';
		} catch (err) {
			message = err instanceof Error ? err.message : 'Create failed.';
		} finally {
			creating = false;
		}
	}

	function askRemoveSite(site: { id: string; name: string }, e: MouseEvent) {
		e.stopPropagation();
		if (data.site?.id === site.id) return;
		pendingDelete = { id: site.id, name: site.name };
	}

	function cancelRemoveSite() {
		if (deletingId) return;
		pendingDelete = null;
	}

	async function confirmRemoveSite() {
		if (!pendingDelete || data.site?.id === pendingDelete.id) return;
		const site = pendingDelete;
		deletingId = site.id;
		message = '';
		try {
			const res = await fetch(`/api/sites/${site.id}`, { method: 'DELETE' });
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Failed to remove site');
			pendingDelete = null;
			await invalidateAll();
			message = `Removed “${site.name}”.`;
		} catch (err) {
			message = err instanceof Error ? err.message : 'Remove failed.';
		} finally {
			deletingId = null;
		}
	}

	function switchSite(id: string) {
		siteMenuOpen = false;
		goto(`/dashboard?site=${id}&days=${data.days}&points=${data.points}&chart=${data.chart}`);
	}

	function switchDays(days: number) {
		if (!data.site) return;
		goto(`/dashboard?site=${data.site.id}&days=${days}&points=${data.points}&chart=${data.chart}`);
	}

	function switchPoints(points: number) {
		if (!data.site) return;
		goto(`/dashboard?site=${data.site.id}&days=${data.days}&points=${points}&chart=${data.chart}`);
	}

	function switchChart(chart: 'line' | 'bars') {
		if (!data.site) return;
		goto(`/dashboard?site=${data.site.id}&days=${data.days}&points=${data.points}&chart=${chart}`);
	}

	async function checkout(plan: 'indie' | 'creator') {
		window.location.href = `/subscribe?plan=${plan}&next=${encodeURIComponent('/dashboard?billing=success')}`;
	}

	async function portal() {
		const res = await fetch('/api/billing/portal', { method: 'POST' });
		const payload = await res.json();
		if (payload.url) window.location.href = payload.url;
	}

	async function copyTracker() {
		if (!data.site) return;
		const allow =
			data.site.ignore_localhost === false ? ' data-allow-localhost' : '';
		try {
			await navigator.clipboard.writeText(
				`<script defer src="${origin}/tracker.js" data-site="${data.site.id}"${allow}></scr` +
					'ipt>'
			);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* clipboard unavailable */
		}
	}

	async function saveTracking(patch: {
		ignore_localhost?: boolean;
		excluded_ips?: string[];
	}) {
		if (!data.site) throw new Error('No active site');
		const res = await fetch(`/api/sites/${data.site.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		const payload = await res.json().catch(() => ({}));
		if (!res.ok) {
			throw new Error(
				typeof payload.message === 'string'
					? payload.message
					: 'Failed to save tracking settings'
			);
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>
		{data.site ? `${data.site.name} — Mission Control` : 'Mission Control'} — Statsman
	</title>
</svelte:head>

<div bind:this={root}>
	{#if showOnboarding}
		<OnboardingModal
			open={true}
			isCloud={data.isCloud}
			billingEnabled={data.billingEnabled}
			userEmail={data.user?.email ?? null}
			plan={data.user?.plan ?? 'free'}
			publicOrigin={data.publicOrigin}
			initialSite={data.firstOperatorSite}
			billingFlash={data.billingFlash}
			onComplete={() => {
				showOnboarding = false;
			}}
		/>
	{/if}

	<SettingsModal
		open={settingsOpen}
		bind:tab={settingsTab}
		sites={data.sites}
		activeSiteId={data.site?.id ?? null}
		site={data.site}
		{origin}
		clientIp={data.clientIp}
		demoEnabled={Boolean(data.demoSiteId)}
		isCloud={data.isCloud}
		billingEnabled={data.billingEnabled}
		userEmail={data.user?.email ?? null}
		usage={data.usage}
		{creating}
		{deletingId}
		{message}
		{copied}
		bind:name
		bind:domain
		onClose={() => (settingsOpen = false)}
		onCreateSite={createSite}
		onAskRemove={askRemoveSite}
		onSwitchSite={switchSite}
		onCopyTracker={copyTracker}
		onCheckout={checkout}
		onPortal={portal}
		onSaveTracking={saveTracking}
		blockEscape={Boolean(pendingDelete)}
	/>

	<ConsoleFrame>
		{#snippet header()}
			<header class="command-bar sticky top-3 z-40 mb-5" data-enter>
				<div class="flex items-center gap-3 min-w-0">
					<a href="/" class="brand-mark text-base no-underline shrink-0">Statsman</a>
					<span class="badge badge-primary shrink-0">{data.isCloud ? 'cloud' : 'selfhost'}</span>
					<span class="hidden md:inline text-[0.65rem] font-mono text-scifi-muted tracking-wider tabular-nums">
						{clock || '—:—:—'}
					</span>
				</div>

				<div class="flex items-center gap-2 flex-wrap justify-end min-w-0">
					<button
						type="button"
						class="live-toggle {live ? 'is-live' : ''}"
						title="Toggle live refresh"
						onclick={() => (live = !live)}
					>
						<span class="live-dot"></span>
						{live ? 'LIVE' : 'PAUSED'}
					</button>

					{#if data.sites.length > 0}
						<div class="site-switch relative" bind:this={siteMenuRoot}>
							<button
								type="button"
								class="site-switch-btn"
								aria-haspopup="listbox"
								aria-expanded={siteMenuOpen}
								onclick={(e) => {
									e.stopPropagation();
									siteMenuOpen = !siteMenuOpen;
								}}
							>
								<span class="site-switch-signal" aria-hidden="true"></span>
								<span class="min-w-0 text-left">
									<span class="block text-xs font-semibold truncate max-w-[7rem] sm:max-w-[11rem]">
										{data.site?.name ?? 'Select site'}
									</span>
									<span class="block text-[0.6rem] text-scifi-muted truncate max-w-[7rem] sm:max-w-[11rem]">
										{data.site?.domain ?? '—'}
									</span>
								</span>
								<span class="site-chevron" aria-hidden="true">▾</span>
							</button>
							{#if siteMenuOpen}
								<div class="site-menu" role="listbox" aria-label="Sites">
									{#each data.sites as s (s.id)}
										<button
											type="button"
											role="option"
											class="site-menu-item {data.site?.id === s.id ? 'is-active' : ''}"
											aria-selected={data.site?.id === s.id}
											onclick={() => switchSite(s.id)}
										>
											<span class="truncate font-semibold">{s.name}</span>
											<span class="truncate text-[0.65rem] text-scifi-muted">{s.domain}</span>
										</button>
									{/each}
									<button
										type="button"
										class="site-menu-item site-menu-manage"
										onclick={() => openSettings('sites')}
									>
										Manage sites…
									</button>
								</div>
							{/if}
						</div>
					{/if}

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

					<button
						type="button"
						class="btn btn-sm btn-primary"
						onclick={() => openSettings('sites')}
						title="Settings (⌘,)"
					>
						Settings
					</button>

					<button
						type="button"
						class="identity-chip"
						title="Account"
						onclick={() => openSettings('account')}
					>
						<span class="text-[0.6rem] text-scifi-muted tracking-[0.1em] uppercase truncate">
							{identityMeta}
						</span>
						<span class="text-xs font-semibold text-scifi-cyan truncate">{identityLabel}</span>
					</button>

					<a class="btn btn-xs btn-ghost shrink-0" href="/auth/logout">Logout</a>
				</div>
			</header>
		{/snippet}

		<div class="space-y-4">
			{#if data.billingFlash === 'success'}
				<div class="alert alert-success text-sm" data-deck>Billing updated. Welcome aboard.</div>
			{/if}

			{#if data.usage?.overCap}
				<div class="cap-banner" data-deck>
					<div>
						<span class="badge badge-error">Over cap</span>
						<span class="text-sm text-scifi-muted ml-2">Ingest paused for this month.</span>
					</div>
					<button type="button" class="btn btn-primary btn-sm" onclick={() => openSettings('account')}>
						Manage plan
					</button>
				</div>
			{/if}

			{#if data.site && !data.hasEvents}
				<div class="waiting-panel" data-deck>
					<div class="waiting-pulse" aria-hidden="true"></div>
					<div class="relative z-[1]">
						<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
							<p class="label-kicker text-scifi-primary m-0">// Awaiting first transmission</p>
							{#if polling}<span class="badge badge-primary">polling</span>{/if}
						</div>
						<h2 class="text-xl sm:text-2xl font-extrabold tracking-tight m-0 mb-2">
							Listening for <span class="text-scifi-primary">{data.site.name}</span>
						</h2>
						<p class="text-sm text-scifi-muted m-0 mb-4 max-w-xl leading-relaxed">
							Install the tracker, open a page on your site, and this console lights up automatically.
						</p>
						<div class="flex flex-wrap gap-2">
							<button type="button" class="btn btn-primary" onclick={() => openSettings('tracker')}>
								Install tracker
							</button>
							{#if data.demoSiteId}
								<a href="/demo" data-sveltekit-reload class="btn btn-ghost">Open demo blog</a>
							{/if}
						</div>
						<p class="font-mono text-[0.65rem] text-scifi-cyan mt-4 mb-0">site · {data.site.id}</p>
					</div>
				</div>
			{/if}

			{#if data.stats && data.site}
				<MissionConsole
					site={data.site}
					stats={data.stats}
					recentEvents={data.recentEvents}
					days={data.days}
					points={data.points}
					chart={data.chart}
					{live}
					onPointsChange={switchPoints}
					onChartChange={switchChart}
				/>
			{:else if !data.site}
				<section class="empty-deck" data-deck>
					<p class="label-kicker text-scifi-primary m-0 mb-2">// No signal lock</p>
					<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight m-0 mb-3">
						Bring a site online
					</h2>
					<p class="text-sm text-scifi-muted m-0 mb-6 max-w-md mx-auto leading-relaxed">
						Add your first property in settings — then drop the tracker and watch the console wake up.
					</p>
					<button type="button" class="btn-cta" onclick={() => openSettings('sites')}>
						Open settings
					</button>
				</section>
			{/if}
		</div>
	</ConsoleFrame>

	{#if pendingDelete}
		<div
			class="modal-backdrop !z-[220]"
			role="presentation"
			onclick={(e) => {
				if (e.target === e.currentTarget) cancelRemoveSite();
			}}
		>
			<div class="modal" role="dialog" aria-modal="true" aria-labelledby="remove-site-title" tabindex="-1">
				<h2 id="remove-site-title" class="modal-title">Stop tracking “{pendingDelete.name}”?</h2>
				<p class="modal-body">
					This deletes the site and all of its events. This cannot be undone.
				</p>
				<div class="modal-actions">
					<button
						type="button"
						class="btn btn-ghost"
						disabled={deletingId === pendingDelete.id}
						onclick={cancelRemoveSite}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-danger"
						disabled={deletingId === pendingDelete.id}
						onclick={confirmRemoveSite}
					>
						{deletingId === pendingDelete.id ? 'Removing…' : 'Remove site'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.site-switch-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 14rem;
		padding: 0.3rem 0.55rem 0.3rem 0.45rem;
		border-radius: 10px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.35);
		color: inherit;
		cursor: pointer;
		transition: border-color 0.18s ease;
	}
	.site-switch-btn:hover,
	.site-switch-btn[aria-expanded='true'] {
		border-color: rgba(var(--scifi-primary-rgb), 0.5);
	}
	.site-switch-signal {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--scifi-primary);
		box-shadow: 0 0 8px var(--scifi-primary-glow);
		flex-shrink: 0;
	}
	.site-chevron {
		font-size: 0.6rem;
		color: var(--scifi-muted);
		margin-left: 0.15rem;
	}
	.site-menu {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: 50;
		min-width: 14rem;
		max-height: 16rem;
		overflow-y: auto;
		padding: 0.35rem;
		border-radius: 12px;
		border: 1px solid var(--scifi-border-accent);
		background: rgba(var(--scifi-surface-1-rgb), 0.97);
		box-shadow: 0 16px 40px -12px rgba(var(--scifi-shadow-rgb), 0.65);
		backdrop-filter: blur(12px);
		animation: menu-in 0.16s var(--scifi-ease, ease-out);
	}
	.site-menu-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font-size: 0.8rem;
	}
	.site-menu-item:hover,
	.site-menu-item.is-active {
		background: rgba(var(--scifi-primary-rgb), 0.1);
	}
	.site-menu-manage {
		margin-top: 0.2rem;
		border-top: 1px solid var(--scifi-border);
		border-radius: 0 0 8px 8px;
		color: var(--scifi-cyan);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.identity-chip {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.05rem;
		min-width: 0;
		max-width: 11rem;
		padding: 0.3rem 0.65rem;
		border-radius: 10px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.35);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.18s ease;
	}
	.identity-chip:hover {
		border-color: rgba(var(--scifi-cyan-rgb), 0.45);
	}
	@media (min-width: 640px) {
		.identity-chip {
			max-width: 15rem;
		}
	}

	.cap-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		border: 1px solid rgba(var(--scifi-error-rgb), 0.4);
		background: rgba(var(--scifi-error-rgb), 0.08);
	}

	.waiting-panel,
	.empty-deck {
		position: relative;
		overflow: hidden;
		border-radius: 14px;
		border: 1px solid var(--scifi-border-accent);
		background: linear-gradient(
			165deg,
			rgba(var(--scifi-surface-1-rgb), 0.78),
			rgba(var(--scifi-surface-2-rgb), 0.9)
		);
		box-shadow: 0 16px 48px -24px rgba(var(--scifi-shadow-rgb), 0.5);
	}

	.waiting-panel {
		padding: 1.35rem 1.35rem 1.25rem;
	}
	.waiting-pulse {
		position: absolute;
		inset: -40% auto auto 50%;
		width: 18rem;
		height: 18rem;
		transform: translateX(-50%);
		background: radial-gradient(circle, rgba(var(--scifi-primary-rgb), 0.22), transparent 65%);
		animation: wait-pulse 3.2s ease-in-out infinite;
	}

	.empty-deck {
		text-align: center;
		padding: 3rem 1.5rem;
	}

	@keyframes wait-pulse {
		0%,
		100% {
			opacity: 0.55;
			transform: translateX(-50%) scale(1);
		}
		50% {
			opacity: 0.9;
			transform: translateX(-50%) scale(1.08);
		}
	}
	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.waiting-pulse,
		.site-menu {
			animation: none;
		}
	}
</style>
