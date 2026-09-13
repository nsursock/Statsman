<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { enterShell, gsap, createToaster } from '@scifiui/core/js';
	import ConsoleFrame from '$lib/components/ConsoleFrame.svelte';
	import MissionConsole from '$lib/components/MissionConsole.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import DashboardNav from '$lib/components/DashboardNav.svelte';
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

		const toastHost = document.createElement('div');
		toastHost.className = 'toast toast-top toast-end';
		document.body.appendChild(toastHost);
		const toaster = createToaster(toastHost);

		if (data.billingFlash === 'success') {
			const planHint = new URLSearchParams(window.location.search).get('plan');
			const label =
				planHint === 'creator' ? 'Creator' : planHint === 'indie' ? 'Indie' : 'your plan';
			toaster.success(`Subscribed — welcome to ${label}.`, { ttl: 4200 });
			const url = new URL(window.location.href);
			url.searchParams.delete('billing');
			url.searchParams.delete('plan');
			history.replaceState({}, '', url.pathname + url.search);
		} else if (data.billingFlash === 'canceled') {
			toaster.info('Back on Free. Come back anytime.', { ttl: 4200 });
			const url = new URL(window.location.href);
			url.searchParams.delete('billing');
			history.replaceState({}, '', url.pathname + url.search);
		} else if (data.billingFlash === 'cancel') {
			toaster.warning('Checkout canceled — still on Free.', { ttl: 3600 });
			const url = new URL(window.location.href);
			url.searchParams.delete('billing');
			history.replaceState({}, '', url.pathname + url.search);
		}

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

		window.addEventListener('keydown', onKey);
		return () => {
			timers.forEach(clearInterval);
			window.removeEventListener('keydown', onKey);
			toastHost.remove();
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
		const current = data.user?.plan;
		if (current === 'indie' || current === 'creator') {
			window.location.href = '/billing';
			return;
		}
		window.location.href = `/subscribe?plan=${plan}&next=${encodeURIComponent(`/dashboard?billing=success&plan=${plan}`)}`;
	}

	async function portal() {
		window.location.href = '/billing';
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
			<DashboardNav
				isCloud={data.isCloud}
				sites={data.sites}
				site={data.site}
				days={data.days}
				bind:live
				{clock}
				{identityLabel}
				{identityMeta}
				bind:siteMenuOpen
				onSwitchSite={switchSite}
				onSwitchDays={switchDays}
				onOpenSettings={openSettings}
			/>
		{/snippet}

		<div class="space-y-4">
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

	@media (prefers-reduced-motion: reduce) {
		.waiting-pulse {
			animation: none;
		}
	}
</style>
