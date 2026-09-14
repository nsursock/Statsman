<script lang="ts">
	import { tick } from 'svelte';
	import './settings/settings.css';
	import type { SettingsTab, Site, Usage, TrackingPatch } from './settings/types';
	import SitesTab from './settings/SitesTab.svelte';
	import TrackerTab from './settings/TrackerTab.svelte';
	import AppearanceTab from './settings/AppearanceTab.svelte';
	import DemoTab from './settings/DemoTab.svelte';
	import AccountTab from './settings/AccountTab.svelte';

	let {
		open = false,
		tab = $bindable<SettingsTab>('sites'),
		sites,
		activeSiteId = null,
		site = null,
		origin,
		clientIp = null,
		demoEnabled = false,
		isCloud = false,
		billingEnabled = false,
		userEmail = null,
		usage = null,
		creating = false,
		deletingId = null,
		message = '',
		copied = false,
		name = $bindable(''),
		domain = $bindable(''),
		onClose,
		onCreateSite,
		onAskRemove,
		onSwitchSite,
		onCopyTracker,
		onCheckout,
		onPortal,
		onSaveTracking,
		blockEscape = false
	}: {
		open?: boolean;
		tab?: SettingsTab;
		sites: Site[];
		activeSiteId?: string | null;
		site?: Site | null;
		origin: string;
		clientIp?: string | null;
		demoEnabled?: boolean;
		isCloud?: boolean;
		billingEnabled?: boolean;
		userEmail?: string | null;
		usage?: Usage;
		creating?: boolean;
		deletingId?: string | null;
		message?: string;
		copied?: boolean;
		name?: string;
		domain?: string;
		onClose: () => void;
		onCreateSite: (e: Event) => void | Promise<void>;
		onAskRemove: (site: Site, e: MouseEvent) => void;
		onSwitchSite: (id: string) => void;
		onCopyTracker: () => void | Promise<void>;
		onCheckout: (plan: 'indie' | 'creator') => void;
		onPortal: () => void | Promise<void>;
		onSaveTracking?: (patch: TrackingPatch) => void | Promise<void>;
		/** When a higher-priority dialog (e.g. delete confirm) is open. */
		blockEscape?: boolean;
	} = $props();

	let panelEl: HTMLDivElement | undefined = $state();
	let contentKey = $state(0);

	const tabs = $derived(
		(
			[
				{ id: 'sites' as const, label: 'Sites', hint: 'Tracked properties' },
				{ id: 'tracker' as const, label: 'Tracker', hint: 'Install & exclusions' },
				{ id: 'appearance' as const, label: 'Appearance', hint: 'Console theme' },
				...(demoEnabled
					? [{ id: 'demo' as const, label: 'Demo', hint: 'Public lab' }]
					: []),
				{
					id: 'account' as const,
					label: isCloud ? 'Account' : 'Operator',
					hint: isCloud ? 'Plan & billing' : 'Local access'
				}
			] as const
		)
	);

	const tabIds = $derived(tabs.map((t) => t.id));
	const activeMeta = $derived(tabs.find((t) => t.id === tab) ?? tabs[0]);

	$effect(() => {
		if (!open) return;
		if (!tabIds.includes(tab)) tab = 'sites';
	});

	$effect(() => {
		if (!open) return;
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		tick().then(() => panelEl?.focus());
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	});

	function selectTab(id: SettingsTab) {
		if (tab === id) return;
		tab = id;
		contentKey += 1;
	}

	function onPanelKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (blockEscape) return;
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key === 'Tab' && panelEl) {
			const focusables = panelEl.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
			const list = [...focusables].filter((el) => el.offsetParent !== null);
			if (list.length === 0) return;
			const first = list[0];
			const last = list[list.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	function backdropPointer(e: MouseEvent | KeyboardEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="settings-backdrop"
		role="presentation"
		onclick={backdropPointer}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		<div
			bind:this={panelEl}
			class="settings-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-title"
			tabindex="-1"
			onkeydown={onPanelKeydown}
		>
			<div class="settings-scan" aria-hidden="true"></div>

			<header class="settings-head">
				<div class="min-w-0">
					<p class="label-kicker text-scifi-primary m-0 mb-1 hidden sm:block">// Mission config</p>
					<h2 id="settings-title" class="m-0 text-lg sm:text-xl font-extrabold tracking-tight">Settings</h2>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<span class="status-chip hidden md:inline-flex"><span class="dot"></span> secured</span>
					<button type="button" class="settings-close" onclick={onClose} aria-label="Close settings">
						<span class="hidden sm:inline">Esc · Close</span>
						<svg class="sm:hidden" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>
			</header>

			<div class="settings-body">
				<div class="settings-nav" aria-label="Settings sections" role="tablist">
					{#each tabs as t}
						<button
							type="button"
							role="tab"
							class="settings-nav-item {tab === t.id ? 'active' : ''}"
							aria-selected={tab === t.id}
							onclick={() => selectTab(t.id)}
						>
							<span class="settings-nav-icon" aria-hidden="true">
								{#if t.id === 'sites'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
								{:else if t.id === 'tracker'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>
								{:else if t.id === 'appearance'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
								{:else if t.id === 'demo'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v12H5z"/><path d="M8 20h8M12 16v4"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0114 0"/></svg>
								{/if}
							</span>
							<span class="settings-nav-copy">
								<span class="settings-nav-label">
									{t.label}
									{#if t.id === 'sites'}
										<span class="badge badge-primary settings-count">{sites.length}</span>
									{/if}
								</span>
								<span class="settings-nav-hint">{t.hint}</span>
							</span>
						</button>
					{/each}
				</div>

				<section class="settings-panel" aria-live="polite">
					<div class="settings-panel-head">
						<p class="label-kicker m-0 mb-1 hidden sm:block">{activeMeta.hint}</p>
						<h3 class="m-0 text-base sm:text-lg font-bold tracking-tight">{activeMeta.label}</h3>
						<p class="settings-panel-hint sm:hidden">{activeMeta.hint}</p>
					</div>

					{#key contentKey}
						<div class="settings-panel-body">
							{#if tab === 'sites'}
								<SitesTab
									{sites}
									{activeSiteId}
									{deletingId}
									bind:name
									bind:domain
									{creating}
									{message}
									{onClose}
									{onCreateSite}
									{onAskRemove}
									{onSwitchSite}
								/>
							{:else if tab === 'tracker'}
								<TrackerTab
									{site}
									{origin}
									{clientIp}
									{copied}
									{onCopyTracker}
									{onSaveTracking}
									onGoToSites={() => selectTab('sites')}
								/>
							{:else if tab === 'appearance'}
								<AppearanceTab />
							{:else if tab === 'demo'}
								<DemoTab />
							{:else}
								<AccountTab
									{isCloud}
									{billingEnabled}
									{userEmail}
									{usage}
									{onCheckout}
									{onPortal}
								/>
							{/if}
						</div>
					{/key}
				</section>
			</div>
		</div>
	</div>
{/if}
