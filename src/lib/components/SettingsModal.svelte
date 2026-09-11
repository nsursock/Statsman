<script lang="ts">
	import { tick } from 'svelte';
	import {
		THEME_IDS,
		THEME_META,
		applyTheme,
		readStoredTheme,
		type ThemeId
	} from '$lib/themes';

	export type SettingsTab = 'sites' | 'tracker' | 'appearance' | 'demo' | 'account';

	type Site = { id: string; name: string; domain: string };
	type Usage = {
		used: number;
		limit: number;
		sitesLimit: number;
		sitesUsed: number;
		plan: string;
		pct: number;
		overCap: boolean;
	} | null;

	let {
		open = false,
		tab = $bindable<SettingsTab>('sites'),
		sites,
		activeSiteId = null,
		site = null,
		origin,
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
		blockEscape = false
	}: {
		open?: boolean;
		tab?: SettingsTab;
		sites: Site[];
		activeSiteId?: string | null;
		site?: Site | null;
		origin: string;
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
		/** When a higher-priority dialog (e.g. delete confirm) is open. */
		blockEscape?: boolean;
	} = $props();

	let panelEl: HTMLDivElement | undefined = $state();
	let theme = $state<ThemeId>('retrowave');
	let contentKey = $state(0);

	const tabs = $derived(
		(
			[
				{ id: 'sites' as const, label: 'Sites', hint: 'Tracked properties' },
				{ id: 'tracker' as const, label: 'Tracker', hint: 'Install snippet' },
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
	const snippet = $derived(
		site
			? `<script defer src="${origin}/tracker.js" data-site="${site.id}"></scr` + 'ipt>'
			: ''
	);

	$effect(() => {
		if (!open) return;
		if (!tabIds.includes(tab)) tab = 'sites';
	});

	$effect(() => {
		if (!open) return;
		theme = readStoredTheme();
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

	function pickTheme(id: ThemeId) {
		theme = id;
		applyTheme(id);
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
					<p class="label-kicker text-scifi-primary m-0 mb-1">// Mission config</p>
					<h2 id="settings-title" class="m-0 text-xl font-extrabold tracking-tight">Settings</h2>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<span class="status-chip hidden sm:inline-flex"><span class="dot"></span> secured</span>
					<button type="button" class="btn btn-sm btn-ghost" onclick={onClose} aria-label="Close settings">
						Esc · Close
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
						<p class="label-kicker m-0 mb-1">{activeMeta.hint}</p>
						<h3 class="m-0 text-lg font-bold tracking-tight">{activeMeta.label}</h3>
					</div>

					{#key contentKey}
						<div class="settings-panel-body">
							{#if tab === 'sites'}
								{#if sites.length}
									<ul class="site-list">
										{#each sites as s (s.id)}
											<li class="site-card {activeSiteId === s.id ? 'is-active' : ''}">
												<button
													type="button"
													class="site-main"
													onclick={() => {
														onSwitchSite(s.id);
														onClose();
													}}
												>
													<span class="site-signal" aria-hidden="true"></span>
													<span class="min-w-0 text-left">
														<span class="block font-semibold truncate">{s.name}</span>
														<span class="block text-[0.7rem] text-scifi-muted truncate">{s.domain}</span>
													</span>
													{#if activeSiteId === s.id}
														<span class="badge badge-primary shrink-0">active</span>
													{/if}
												</button>
												{#if activeSiteId !== s.id}
													<button
														type="button"
														class="site-remove"
														title="Stop tracking {s.name}"
														aria-label="Stop tracking {s.name}"
														disabled={deletingId === s.id}
														onclick={(e) => onAskRemove(s, e)}
													>
														{deletingId === s.id ? '…' : 'Remove'}
													</button>
												{/if}
											</li>
										{/each}
									</ul>
								{:else}
									<div class="empty-pane">
										<p class="m-0 text-sm text-scifi-muted">
											No sites yet. Add your first property to start collecting telemetry.
										</p>
									</div>
								{/if}

								<form class="add-site" onsubmit={onCreateSite}>
									<p class="label-kicker mb-2">Add site</p>
									<div class="grid gap-2 sm:grid-cols-2">
										<label class="block space-y-1">
											<span class="text-[0.65rem] uppercase tracking-[0.12em] text-scifi-muted">Name</span>
											<input class="input" bind:value={name} required placeholder="My indie blog" autocomplete="off" />
										</label>
										<label class="block space-y-1">
											<span class="text-[0.65rem] uppercase tracking-[0.12em] text-scifi-muted">Domain</span>
											<input class="input" bind:value={domain} required placeholder="example.com" autocomplete="off" />
										</label>
									</div>
									{#if message}
										<p class="text-xs text-scifi-cyan m-0 mt-2">{message}</p>
									{/if}
									<button class="btn btn-primary w-full sm:w-auto mt-3" type="submit" disabled={creating}>
										{creating ? 'Creating…' : 'Create site'}
									</button>
								</form>
							{:else if tab === 'tracker'}
								{#if site}
									<p class="text-sm text-scifi-muted m-0 mb-3 leading-relaxed">
										Drop this on <strong class="text-[var(--scifi-text)]">{site.name}</strong>
										({site.domain}) before <code class="text-scifi-cyan">&lt;/body&gt;</code>.
										~1&nbsp;KB, zero cookies.
									</p>
									<div class="snippet-block">
										<div class="snippet-toolbar">
											<span class="status-chip"><span class="dot"></span> tracker.js</span>
											<button type="button" class="btn btn-xs btn-primary" onclick={onCopyTracker}>
												{copied ? 'Copied' : 'Copy snippet'}
											</button>
										</div>
										<pre class="snippet-code">{snippet}</pre>
									</div>
									<p class="text-sm text-scifi-muted m-0 mt-4 mb-2 leading-relaxed">
										Custom events (optional) — after the snippet loads:
									</p>
									<pre class="snippet-code text-[0.7rem]">{`statsman.track('newsletter_click')
statsman.track('signup', { plan: 'indie' })`}</pre>
									<p class="text-[0.65rem] text-scifi-muted mt-3 mb-0 font-mono">site · {site.id}</p>
								{:else}
									<div class="empty-pane">
										<p class="m-0 text-sm text-scifi-muted mb-3">
											Create a site first — the install snippet is site-scoped.
										</p>
										<button type="button" class="btn btn-primary btn-sm" onclick={() => selectTab('sites')}>
											Add a site
										</button>
									</div>
								{/if}
							{:else if tab === 'appearance'}
								<p class="text-sm text-scifi-muted m-0 mb-4 leading-relaxed">
									Pick a console skin. Saved on this device — no account required.
								</p>
								<div class="theme-grid" role="listbox" aria-label="Themes">
									{#each THEME_IDS as id}
										<button
											type="button"
											role="option"
											class="theme-card {theme === id ? 'is-active' : ''}"
											aria-selected={theme === id}
											onclick={() => pickTheme(id)}
										>
											<span class="theme-swatches" aria-hidden="true">
												{#each THEME_META[id].swatch as c}
													<span class="theme-swatch" style="background: {c}"></span>
												{/each}
											</span>
											<span class="theme-label">{THEME_META[id].label}</span>
											{#if theme === id}
												<span class="theme-check" aria-hidden="true">●</span>
											{/if}
										</button>
									{/each}
								</div>
							{:else if tab === 'demo'}
								<div class="demo-hero">
									<p class="label-kicker text-scifi-primary m-0 mb-2">Public · ungated</p>
									<p class="text-sm leading-relaxed m-0 mb-4 text-scifi-muted">
										A fake indie blog instrumented with the real tracker, plus a public console.
										Never counted among your tracked websites.
									</p>
									<div class="flex flex-col sm:flex-row gap-2">
										<a href="/demo" data-sveltekit-reload class="btn btn-primary text-center">Open fake blog</a>
										<a href="/demo/console" class="btn btn-ghost text-center">Enter demo console</a>
									</div>
								</div>
							{:else}
								<div class="account-card">
									<p class="text-[0.65rem] uppercase tracking-[0.14em] text-scifi-muted m-0 mb-1">
										{isCloud ? 'Signed in' : 'Access mode'}
									</p>
									<p class="text-base font-bold text-scifi-cyan m-0 break-all">
										{userEmail ?? (isCloud ? '—' : 'Self-host operator')}
									</p>
									<p class="text-xs text-scifi-muted m-0 mt-1">
										{#if isCloud}
											Cloud account · magic-link auth
										{:else}
											Local console · ADMIN_TOKEN / access cookie
										{/if}
									</p>
								</div>

								{#if usage}
									<div class="usage-card">
										<div class="flex items-baseline justify-between gap-2 mb-2">
											<span class="label-kicker m-0">Plan · {usage.plan}</span>
											{#if usage.overCap}
												<span class="badge badge-error">Over cap</span>
											{/if}
										</div>
										<p class="text-sm text-scifi-muted m-0 mb-2">
											{usage.used.toLocaleString()} / {usage.limit.toLocaleString()} pageviews ·
											{usage.sitesUsed}/{usage.sitesLimit} sites
										</p>
										<div class="usage-meter">
											<div
												class="usage-fill {usage.overCap ? 'is-over' : ''}"
												style="width: {usage.pct}%"
											></div>
										</div>
										<div class="flex flex-wrap gap-2 mt-4">
											{#if billingEnabled && usage.plan === 'free'}
												<button type="button" class="btn btn-primary btn-sm" onclick={() => onCheckout('indie')}>
													Upgrade Indie $9
												</button>
												<button type="button" class="btn btn-ghost btn-sm" onclick={() => onCheckout('creator')}>
													Creator $19
												</button>
											{:else if billingEnabled}
												<button type="button" class="btn btn-ghost btn-sm" onclick={onPortal}>
													Manage billing
												</button>
											{:else}
												<a class="btn btn-ghost btn-sm" href="/pricing">View plans</a>
											{/if}
										</div>
									</div>
								{:else if !isCloud}
									<p class="text-sm text-scifi-muted m-0 mt-4 leading-relaxed">
										Self-host has no plan caps. Your data stays on this machine.
									</p>
								{/if}

								<a class="btn btn-ghost btn-sm mt-4" href="/auth/logout">Log out</a>
							{/if}
						</div>
					{/key}
				</section>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(var(--scifi-backdrop-rgb), 0.62);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: settings-fade 0.2s var(--scifi-ease, ease-out);
	}

	.settings-sheet {
		position: relative;
		width: min(52rem, 100%);
		max-height: min(40rem, calc(100vh - 2rem));
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 14px;
		border: 1px solid var(--scifi-border-accent);
		background: linear-gradient(
			165deg,
			rgba(var(--scifi-surface-1-rgb), 0.97),
			rgba(var(--scifi-surface-2-rgb), 0.99)
		);
		box-shadow:
			0 24px 64px -16px rgba(var(--scifi-shadow-rgb), 0.7),
			0 0 0 1px rgba(var(--scifi-primary-rgb), 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
		outline: none;
		animation: settings-rise 0.28s var(--scifi-ease, ease-out);
	}

	.settings-scan {
		pointer-events: none;
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			transparent 0%,
			rgba(var(--scifi-primary-rgb), 0.03) 50%,
			transparent 100%
		);
		background-size: 100% 220%;
		animation: settings-scan 7s linear infinite;
		opacity: 0.7;
	}

	.settings-head {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 1.25rem 0.95rem;
		border-bottom: 1px solid var(--scifi-border);
	}

	.settings-body {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: 11.5rem 1fr;
		min-height: 0;
		flex: 1;
	}

	.settings-nav {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 0.55rem;
		border-right: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.35);
		overflow-y: auto;
	}

	.settings-nav-item {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		width: 100%;
		padding: 0.55rem 0.55rem;
		border: 1px solid transparent;
		border-radius: 10px;
		background: transparent;
		color: var(--scifi-muted);
		text-align: left;
		cursor: pointer;
		transition:
			background 0.18s var(--scifi-ease, ease),
			border-color 0.18s var(--scifi-ease, ease),
			color 0.18s var(--scifi-ease, ease);
	}
	.settings-nav-item:hover {
		color: var(--scifi-text);
		background: rgba(var(--scifi-primary-rgb), 0.06);
	}
	.settings-nav-item.active {
		color: var(--scifi-text);
		border-color: rgba(var(--scifi-primary-rgb), 0.35);
		background: linear-gradient(
			135deg,
			rgba(var(--scifi-primary-rgb), 0.14),
			rgba(var(--scifi-cyan-rgb), 0.06)
		);
		box-shadow: 0 0 18px rgba(var(--scifi-primary-rgb), 0.12);
	}

	.settings-nav-icon {
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.1rem;
		flex-shrink: 0;
		color: var(--scifi-primary);
		opacity: 0.85;
	}
	.settings-nav-icon :global(svg) {
		width: 100%;
		height: 100%;
	}
	.settings-nav-item:not(.active) .settings-nav-icon {
		color: var(--scifi-muted);
		opacity: 0.7;
	}

	.settings-nav-copy {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.settings-nav-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.settings-nav-hint {
		font-size: 0.62rem;
		letter-spacing: 0.02em;
		opacity: 0.75;
		line-height: 1.25;
	}
	.settings-count {
		font-size: 0.55rem !important;
		padding: 0.05rem 0.35rem !important;
	}

	.settings-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
	.settings-panel-head {
		padding: 1rem 1.25rem 0.35rem;
	}
	.settings-panel-body {
		padding: 0.5rem 1.25rem 1.25rem;
		overflow-y: auto;
		animation: settings-panel-in 0.22s var(--scifi-ease, ease-out);
	}

	.site-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.site-card {
		display: flex;
		align-items: stretch;
		gap: 0.35rem;
		border-radius: 10px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-surface-1-rgb), 0.45);
		overflow: hidden;
		transition:
			border-color 0.18s ease,
			box-shadow 0.18s ease;
	}
	.site-card.is-active {
		border-color: rgba(var(--scifi-primary-rgb), 0.55);
		box-shadow: 0 0 0 1px rgba(var(--scifi-primary-rgb), 0.15), 0 0 20px rgba(var(--scifi-primary-rgb), 0.12);
	}
	.site-main {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		padding: 0.7rem 0.75rem;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.site-main:hover {
		background: rgba(var(--scifi-primary-rgb), 0.05);
	}
	.site-signal {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--scifi-muted);
		flex-shrink: 0;
		box-shadow: none;
	}
	.site-card.is-active .site-signal {
		background: var(--scifi-primary);
		box-shadow: 0 0 10px var(--scifi-primary-glow);
	}
	.site-remove {
		border: 0;
		border-left: 1px solid var(--scifi-border);
		background: transparent;
		color: var(--scifi-muted);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0 0.85rem;
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
	}
	.site-remove:hover:not(:disabled) {
		color: var(--scifi-error);
		background: rgba(var(--scifi-error-rgb, 220, 50, 50), 0.08);
	}
	.site-remove:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.add-site {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--scifi-border);
	}

	.empty-pane {
		padding: 1rem;
		border-radius: 10px;
		border: 1px dashed var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.25);
	}

	.snippet-block {
		border-radius: 12px;
		border: 1px solid var(--scifi-border-accent);
		overflow: hidden;
		background: rgba(var(--scifi-bg-deep-rgb), 0.55);
		box-shadow: inset 0 0 24px rgba(var(--scifi-primary-rgb), 0.05);
	}
	.snippet-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-surface-1-rgb), 0.4);
	}
	.snippet-code {
		margin: 0;
		padding: 0.9rem 1rem;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--scifi-cyan);
		white-space: pre-wrap;
		word-break: break-all;
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.55rem;
	}
	.theme-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-surface-1-rgb), 0.4);
		color: var(--scifi-text);
		cursor: pointer;
		text-align: left;
		transition:
			border-color 0.18s ease,
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}
	.theme-card:hover {
		transform: translateY(-1px);
		border-color: rgba(var(--scifi-primary-rgb), 0.4);
	}
	.theme-card.is-active {
		border-color: rgba(var(--scifi-primary-rgb), 0.65);
		box-shadow: 0 0 0 1px rgba(var(--scifi-primary-rgb), 0.2), 0 0 22px rgba(var(--scifi-primary-rgb), 0.15);
	}
	.theme-swatches {
		display: flex;
		gap: 0.3rem;
	}
	.theme-swatch {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 999px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
	}
	.theme-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.theme-check {
		position: absolute;
		top: 0.55rem;
		right: 0.65rem;
		color: var(--scifi-primary);
		font-size: 0.55rem;
		text-shadow: 0 0 8px var(--scifi-primary-glow);
	}

	.demo-hero,
	.account-card,
	.usage-card {
		padding: 1rem;
		border-radius: 12px;
		border: 1px solid var(--scifi-border);
		background: linear-gradient(
			145deg,
			rgba(var(--scifi-primary-rgb), 0.08),
			rgba(var(--scifi-surface-1-rgb), 0.5)
		);
	}
	.usage-card {
		margin-top: 0.75rem;
		background: rgba(var(--scifi-surface-1-rgb), 0.45);
	}
	.usage-meter {
		height: 0.4rem;
		border-radius: 999px;
		background: rgba(var(--scifi-muted-rgb), 0.18);
		overflow: hidden;
	}
	.usage-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--scifi-primary), var(--scifi-cyan));
		box-shadow: 0 0 10px var(--scifi-primary-glow);
		transition: width 0.5s ease;
	}
	.usage-fill.is-over {
		background: var(--scifi-error);
		box-shadow: none;
	}

	@keyframes settings-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes settings-rise {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes settings-panel-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes settings-scan {
		from {
			background-position: 0 -40%;
		}
		to {
			background-position: 0 140%;
		}
	}

	@media (max-width: 640px) {
		.settings-body {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}
		.settings-nav {
			flex-direction: row;
			overflow-x: auto;
			border-right: none;
			border-bottom: 1px solid var(--scifi-border);
			padding: 0.55rem;
			scrollbar-width: none;
		}
		.settings-nav::-webkit-scrollbar {
			display: none;
		}
		.settings-nav-item {
			flex: 0 0 auto;
			max-width: 9.5rem;
		}
		.settings-nav-hint {
			display: none;
		}
		.settings-sheet {
			max-height: calc(100vh - 1.25rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.settings-backdrop,
		.settings-sheet,
		.settings-panel-body,
		.settings-scan {
			animation: none;
		}
		.theme-card:hover {
			transform: none;
		}
	}
</style>
