<script lang="ts">
	import { onMount } from 'svelte';

	type Site = { id: string; name: string; domain: string };
	type SettingsTab = 'sites' | 'tracker' | 'appearance' | 'demo' | 'account';
	type Variant = 'operator' | 'demo';

	let {
		variant = 'operator',
		isCloud = false,
		sites = [],
		site = null,
		days = 7,
		live = $bindable(false),
		clock = '',
		identityLabel = '',
		identityMeta = '',
		siteMenuOpen = $bindable(false),
		onSwitchSite,
		onSwitchDays,
		onOpenSettings,
		onLogoutHref = '/auth/logout'
	}: {
		variant?: Variant;
		isCloud?: boolean;
		sites?: Site[];
		site?: Site | null;
		days?: number;
		live?: boolean;
		clock?: string;
		identityLabel?: string;
		identityMeta?: string;
		siteMenuOpen?: boolean;
		onSwitchSite: (id: string) => void;
		onSwitchDays: (days: number) => void;
		onOpenSettings?: (tab?: SettingsTab) => void;
		onLogoutHref?: string;
	} = $props();

	const isDemo = $derived(variant === 'demo');
	const modeLabel = $derived(isDemo ? 'demo' : isCloud ? 'cloud' : 'selfhost');

	let scrolled = $state(false);
	let moreOpen = $state(false);
	let siteMenuRoot: HTMLElement | undefined = $state();
	let moreRoot: HTMLElement | undefined = $state();

	function closeMenus() {
		siteMenuOpen = false;
		moreOpen = false;
	}

	function openSettings(tab: SettingsTab = 'sites') {
		closeMenus();
		onOpenSettings?.(tab);
	}

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 12;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (siteMenuRoot && !siteMenuRoot.contains(t)) siteMenuOpen = false;
			if (moreRoot && !moreRoot.contains(t)) moreOpen = false;
		};
		document.addEventListener('click', onDoc);
		return () => {
			window.removeEventListener('scroll', onScroll);
			document.removeEventListener('click', onDoc);
		};
	});
</script>

<header class="dash-nav" class:dash-nav--scrolled={scrolled} class:dash-nav--demo={isDemo} data-enter>
	<div class="dash-nav__glass">
		<!-- Top row: brand + primary actions -->
		<div class="dash-nav__top">
			<a href="/" class="dash-nav__brand" onclick={closeMenus}>
				<span class="dash-nav__orb" aria-hidden="true">
					<i class="ti ti-chart-dots-3"></i>
				</span>
				<span class="brand-mark dash-nav__wordmark">Statsman</span>
				<span class="dash-nav__mode">{modeLabel}</span>
			</a>

			<div class="dash-nav__clock" aria-hidden="true">{clock || '—:—:—'}</div>

			<div class="dash-nav__actions">
				<button
					type="button"
					class="dash-nav__live {live ? 'is-live' : ''}"
					title="Toggle live refresh"
					aria-pressed={live}
					onclick={() => (live = !live)}
				>
					<span class="dash-nav__live-dot"></span>
					<span class="dash-nav__live-label">{live ? 'LIVE' : 'PAUSE'}</span>
				</button>

				{#if isDemo}
					<a
						class="dash-nav__icon-btn"
						href="/signup"
						title="Sign up"
						aria-label="Sign up"
						onclick={closeMenus}
					>
						<i class="ti ti-rocket" aria-hidden="true"></i>
					</a>
				{:else}
					<button
						type="button"
						class="dash-nav__icon-btn"
						title="Settings (⌘,)"
						aria-label="Settings"
						onclick={() => openSettings('sites')}
					>
						<i class="ti ti-settings" aria-hidden="true"></i>
					</button>
				{/if}

				<div class="dash-nav__more" bind:this={moreRoot}>
					<button
						type="button"
						class="dash-nav__icon-btn"
						aria-label="More"
						aria-expanded={moreOpen}
						aria-haspopup="menu"
						onclick={(e) => {
							e.stopPropagation();
							moreOpen = !moreOpen;
							siteMenuOpen = false;
						}}
					>
						<i class="ti ti-dots-vertical" aria-hidden="true"></i>
					</button>
					{#if moreOpen}
						<div class="dash-nav__menu" role="menu" aria-label={isDemo ? 'Demo menu' : 'Account menu'}>
							{#if isDemo}
								<a
									class="dash-nav__menu-item"
									role="menuitem"
									href="/demo"
									data-sveltekit-reload
									onclick={closeMenus}
								>
									<span class="dash-nav__menu-ico"><i class="ti ti-book"></i></span>
									<span>Fake blog</span>
								</a>
								<a class="dash-nav__menu-item" role="menuitem" href="/signup" onclick={closeMenus}>
									<span class="dash-nav__menu-ico"><i class="ti ti-rocket"></i></span>
									<span class="min-w-0">
										<span class="block text-[0.6rem] uppercase tracking-wider text-scifi-muted">
											{identityMeta}
										</span>
										<span class="block text-xs font-semibold truncate">{identityLabel}</span>
									</span>
								</a>
								<a class="dash-nav__menu-item" role="menuitem" href="/login" onclick={closeMenus}>
									<span class="dash-nav__menu-ico"><i class="ti ti-login-2"></i></span>
									<span>Log in</span>
								</a>
								<a class="dash-nav__menu-item dash-nav__menu-danger" role="menuitem" href="/" onclick={closeMenus}>
									<span class="dash-nav__menu-ico"><i class="ti ti-door-exit"></i></span>
									<span>Exit demo</span>
								</a>
							{:else}
								<button
									type="button"
									class="dash-nav__menu-item"
									role="menuitem"
									onclick={() => openSettings('account')}
								>
									<span class="dash-nav__menu-ico"><i class="ti ti-user"></i></span>
									<span class="min-w-0">
										<span class="block text-[0.6rem] uppercase tracking-wider text-scifi-muted">
											{identityMeta}
										</span>
										<span class="block text-xs font-semibold truncate">{identityLabel}</span>
									</span>
								</button>
								<button
									type="button"
									class="dash-nav__menu-item"
									role="menuitem"
									onclick={() => openSettings('tracker')}
								>
									<span class="dash-nav__menu-ico"><i class="ti ti-code"></i></span>
									<span>Tracker snippet</span>
								</button>
								<button
									type="button"
									class="dash-nav__menu-item"
									role="menuitem"
									onclick={() => openSettings('appearance')}
								>
									<span class="dash-nav__menu-ico"><i class="ti ti-palette"></i></span>
									<span>Appearance</span>
								</button>
								<a class="dash-nav__menu-item dash-nav__menu-danger" role="menuitem" href={onLogoutHref}>
									<span class="dash-nav__menu-ico"><i class="ti ti-logout"></i></span>
									<span>Log out</span>
								</a>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Control deck: site + range -->
		<div class="dash-nav__deck">
			{#if sites.length > 0}
				<div class="dash-nav__site" bind:this={siteMenuRoot}>
					<button
						type="button"
						class="dash-nav__site-btn"
						aria-haspopup="listbox"
						aria-expanded={siteMenuOpen}
						onclick={(e) => {
							e.stopPropagation();
							if (isDemo && sites.length <= 1) return;
							siteMenuOpen = !siteMenuOpen;
							moreOpen = false;
						}}
					>
						<span class="dash-nav__site-signal" aria-hidden="true"></span>
						<span class="dash-nav__site-copy">
							<span class="dash-nav__site-name">{site?.name ?? 'Select site'}</span>
							<span class="dash-nav__site-domain">{site?.domain ?? '—'}</span>
						</span>
						{#if !isDemo || sites.length > 1}
							<i class="ti ti-chevron-down dash-nav__site-chevron" aria-hidden="true"></i>
						{/if}
					</button>
					{#if siteMenuOpen}
						<div class="dash-nav__site-menu" role="listbox" aria-label="Sites">
							{#each sites as s (s.id)}
								<button
									type="button"
									role="option"
									class="dash-nav__site-item {site?.id === s.id ? 'is-active' : ''}"
									aria-selected={site?.id === s.id}
									onclick={() => {
										onSwitchSite(s.id);
										siteMenuOpen = false;
									}}
								>
									<span class="truncate font-semibold">{s.name}</span>
									<span class="truncate text-[0.65rem] text-scifi-muted">{s.domain}</span>
								</button>
							{/each}
							{#if !isDemo}
								<button
									type="button"
									class="dash-nav__site-item dash-nav__site-manage"
									onclick={() => openSettings('sites')}
								>
									<i class="ti ti-adjustments-horizontal" aria-hidden="true"></i>
									Manage sites
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<button
					type="button"
					class="dash-nav__site-btn dash-nav__site-btn--empty"
					onclick={() => {
						if (!isDemo) openSettings('sites');
					}}
				>
					<span class="dash-nav__site-signal is-muted" aria-hidden="true"></span>
					<span class="dash-nav__site-copy">
						<span class="dash-nav__site-name">Add a site</span>
						<span class="dash-nav__site-domain">Open settings to start</span>
					</span>
					<i class="ti ti-plus" aria-hidden="true"></i>
				</button>
			{/if}

			<div class="dash-nav__range" role="group" aria-label="Date range">
				{#each [1, 7, 30] as d}
					<button
						type="button"
						class="dash-nav__range-btn {days === d ? 'is-active' : ''}"
						onclick={() => onSwitchDays(d)}
					>
						{d}d
					</button>
				{/each}
			</div>
		</div>
	</div>
</header>

<style>
	.dash-nav {
		position: sticky;
		top: 0.55rem;
		z-index: 40;
		margin-bottom: 1.1rem;
		isolation: isolate;
	}

	.dash-nav__glass {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.55rem 0.6rem 0.6rem;
		border-radius: 1.05rem;
		border: 1px solid color-mix(in oklab, var(--scifi-border) 70%, var(--scifi-primary) 30%);
		background: linear-gradient(
			155deg,
			rgba(var(--scifi-surface-1-rgb), 0.86),
			rgba(var(--scifi-surface-2-rgb), 0.78)
		);
		backdrop-filter: blur(18px) saturate(1.2);
		-webkit-backdrop-filter: blur(18px) saturate(1.2);
		box-shadow:
			0 0 0 1px rgba(var(--scifi-primary-rgb), 0.06),
			0 16px 36px -20px rgba(var(--scifi-shadow-rgb), 0.75);
		transition:
			box-shadow 0.3s ease,
			border-color 0.3s ease;
	}

	.dash-nav--scrolled .dash-nav__glass {
		border-color: color-mix(in oklab, var(--scifi-cyan) 30%, var(--scifi-border));
		box-shadow:
			0 0 0 1px rgba(var(--scifi-cyan-rgb), 0.1),
			0 20px 44px -18px rgba(var(--scifi-shadow-rgb), 0.85),
			0 0 28px -14px rgba(var(--scifi-primary-rgb), 0.3);
	}

	.dash-nav__glass::after {
		content: '';
		position: absolute;
		left: 10%;
		right: 10%;
		bottom: -1px;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--scifi-primary), var(--scifi-cyan), transparent);
		opacity: 0.5;
		pointer-events: none;
	}

	.dash-nav__top {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.dash-nav__brand {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		text-decoration: none;
		padding: 0.15rem 0.2rem;
		border-radius: 0.7rem;
		margin-right: auto;
	}

	.dash-nav__orb {
		display: grid;
		place-items: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 0.6rem;
		background: linear-gradient(
			135deg,
			rgba(var(--scifi-primary-rgb), 0.25),
			rgba(var(--scifi-cyan-rgb), 0.1)
		);
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.35);
		color: var(--scifi-primary);
		font-size: 1rem;
		box-shadow: 0 0 16px -4px var(--scifi-primary-glow);
		flex-shrink: 0;
	}

	.dash-nav__wordmark {
		font-size: 0.98rem;
		line-height: 1;
	}

	.dash-nav__mode {
		display: none;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.2rem 0.4rem;
		border-radius: 999px;
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.35);
		color: var(--scifi-primary);
		background: rgba(var(--scifi-primary-rgb), 0.1);
	}

	.dash-nav__clock {
		display: none;
		font-family: var(--scifi-font-mono, ui-monospace, monospace);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		color: var(--scifi-muted);
		font-variant-numeric: tabular-nums;
	}

	.dash-nav__actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.dash-nav__live {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.35rem;
		padding: 0 0.65rem;
		border-radius: 999px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.45);
		color: var(--scifi-muted);
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			color 0.18s ease,
			box-shadow 0.18s ease;
	}
	.dash-nav__live.is-live {
		color: var(--scifi-success);
		border-color: rgba(var(--scifi-success-rgb), 0.5);
		box-shadow: 0 0 14px rgba(var(--scifi-success-rgb), 0.18);
	}
	.dash-nav__live-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: currentColor;
	}
	.dash-nav__live.is-live .dash-nav__live-dot {
		box-shadow: 0 0 8px currentColor;
		animation: dash-live-blink 1.4s ease-in-out infinite;
	}

	.dash-nav__icon-btn {
		display: grid;
		place-items: center;
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 0.75rem;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.4);
		color: var(--scifi-text);
		font-size: 1.1rem;
		cursor: pointer;
		text-decoration: none;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			box-shadow 0.15s ease;
	}
	.dash-nav__icon-btn:hover,
	.dash-nav__icon-btn[aria-expanded='true'] {
		border-color: rgba(var(--scifi-primary-rgb), 0.5);
		background: rgba(var(--scifi-primary-rgb), 0.1);
		box-shadow: 0 0 14px -6px var(--scifi-primary-glow);
	}

	.dash-nav__more {
		position: relative;
	}

	.dash-nav__menu {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: 60;
		width: min(16.5rem, calc(100vw - 1.5rem));
		padding: 0.4rem;
		border-radius: 0.9rem;
		border: 1px solid var(--scifi-border-accent);
		background: rgba(var(--scifi-surface-1-rgb), 0.98);
		box-shadow: 0 18px 44px -14px rgba(var(--scifi-shadow-rgb), 0.75);
		backdrop-filter: blur(14px);
		animation: dash-menu-in 0.18s var(--scifi-ease, ease-out);
	}

	.dash-nav__menu-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.7rem 0.7rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: inherit;
		text-decoration: none;
		text-align: left;
		font-size: 0.82rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.dash-nav__menu-item:hover {
		background: rgba(var(--scifi-primary-rgb), 0.1);
	}
	.dash-nav__menu-danger {
		margin-top: 0.2rem;
		border-top: 1px solid var(--scifi-border);
		border-radius: 0 0 0.65rem 0.65rem;
		color: var(--scifi-muted);
	}
	.dash-nav__menu-ico {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 0.5rem;
		background: rgba(var(--scifi-primary-rgb), 0.1);
		color: var(--scifi-primary);
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.dash-nav__deck {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.45rem;
		align-items: stretch;
		min-width: 0;
	}

	.dash-nav__site {
		position: relative;
		min-width: 0;
	}

	.dash-nav__site-btn {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		min-height: 2.75rem;
		padding: 0.4rem 0.55rem 0.4rem 0.55rem;
		border-radius: 0.8rem;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.4);
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition: border-color 0.18s ease, box-shadow 0.18s ease;
	}
	.dash-nav__site-btn:hover,
	.dash-nav__site-btn[aria-expanded='true'] {
		border-color: rgba(var(--scifi-primary-rgb), 0.55);
		box-shadow: 0 0 16px -8px var(--scifi-primary-glow);
	}
	.dash-nav__site-btn--empty {
		border-style: dashed;
	}

	.dash-nav__site-signal {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--scifi-primary);
		box-shadow: 0 0 10px var(--scifi-primary-glow);
		flex-shrink: 0;
	}
	.dash-nav__site-signal.is-muted {
		background: var(--scifi-muted);
		box-shadow: none;
	}

	.dash-nav__site-copy {
		min-width: 0;
		flex: 1;
	}
	.dash-nav__site-name {
		display: block;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dash-nav__site-domain {
		display: block;
		font-size: 0.6rem;
		color: var(--scifi-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dash-nav__site-chevron {
		font-size: 0.85rem;
		color: var(--scifi-muted);
		flex-shrink: 0;
	}

	.dash-nav__site-menu {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		z-index: 60;
		max-height: 16rem;
		overflow-y: auto;
		padding: 0.4rem;
		border-radius: 0.9rem;
		border: 1px solid var(--scifi-border-accent);
		background: rgba(var(--scifi-surface-1-rgb), 0.98);
		box-shadow: 0 18px 44px -14px rgba(var(--scifi-shadow-rgb), 0.75);
		backdrop-filter: blur(14px);
		animation: dash-menu-in 0.18s var(--scifi-ease, ease-out);
	}

	.dash-nav__site-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		width: 100%;
		padding: 0.7rem 0.75rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font-size: 0.82rem;
	}
	.dash-nav__site-item:hover,
	.dash-nav__site-item.is-active {
		background: rgba(var(--scifi-primary-rgb), 0.1);
	}
	.dash-nav__site-manage {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.25rem;
		border-top: 1px solid var(--scifi-border);
		border-radius: 0 0 0.65rem 0.65rem;
		color: var(--scifi-cyan);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.dash-nav__range {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem;
		gap: 0.15rem;
		border-radius: 0.8rem;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.4);
		flex-shrink: 0;
	}
	.dash-nav__range-btn {
		border: 0;
		border-radius: 0.55rem;
		min-width: 2.35rem;
		min-height: 2.25rem;
		padding: 0 0.45rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--scifi-muted);
		background: transparent;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}
	.dash-nav__range-btn.is-active {
		color: var(--scifi-active-text, var(--scifi-text));
		background: linear-gradient(
			135deg,
			rgba(var(--scifi-primary-rgb), 0.38),
			rgba(var(--scifi-cyan-rgb), 0.16)
		);
		box-shadow: 0 0 12px rgba(var(--scifi-primary-rgb), 0.22);
	}

	@keyframes dash-live-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	@keyframes dash-menu-in {
		from {
			opacity: 0;
			transform: translateY(-6px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (min-width: 640px) {
		.dash-nav {
			top: 0.75rem;
			margin-bottom: 1.25rem;
		}
		.dash-nav__glass {
			padding: 0.6rem 0.75rem 0.7rem;
			gap: 0.6rem;
		}
		.dash-nav__mode {
			display: inline-flex;
		}
		.dash-nav__clock {
			display: inline-block;
			margin-right: 0.35rem;
		}
		.dash-nav__live-label {
			min-width: 2.6rem;
		}
	}

	@media (min-width: 900px) {
		.dash-nav__glass {
			flex-direction: row;
			align-items: center;
			gap: 0.85rem;
			padding: 0.55rem 0.7rem;
		}
		.dash-nav__top {
			flex: 1;
			min-width: 0;
		}
		.dash-nav__deck {
			flex: 1.15;
			max-width: 28rem;
			margin-left: auto;
		}
		.dash-nav__site-menu {
			left: auto;
			right: 0;
			width: 16rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dash-nav__live.is-live .dash-nav__live-dot,
		.dash-nav__menu,
		.dash-nav__site-menu {
			animation: none;
		}
	}
</style>
