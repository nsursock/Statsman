<script lang="ts">
	import { onMount } from 'svelte';
	import ThemePicker from '$lib/components/ThemePicker.svelte';

	let {
		demo = false,
		authed = false
	}: {
		demo?: boolean;
		authed?: boolean;
	} = $props();

	let open = $state(false);
	let scrolled = $state(false);

	type NavLink = { href: string; label: string; icon: string; reload?: boolean };

	const links = $derived.by((): NavLink[] => [
		...(demo ? [{ href: '/demo/console', label: 'Demo', icon: 'ti-player-play' }] : []),
		{ href: '#why', label: 'Why', icon: 'ti-bulb' },
		{ href: '#how', label: 'How', icon: 'ti-route' },
		{ href: '#plans', label: 'Plans', icon: 'ti-stack-2' },
		{ href: '/self-host', label: 'Self-host', icon: 'ti-server-2' }
	]);

	function close() {
		open = false;
	}

	function toggle() {
		open = !open;
	}

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 18;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('keydown', onKey);

		return () => {
			window.removeEventListener('scroll', onScroll);
			document.removeEventListener('keydown', onKey);
		};
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('nav-lock', open);
		return () => document.documentElement.classList.remove('nav-lock');
	});
</script>

<header
	class="mkt-nav"
	class:mkt-nav--scrolled={scrolled}
	class:mkt-nav--open={open}
	data-enter
>
	<div class="mkt-nav__bar">
		<a href="/" class="mkt-nav__brand" onclick={close}>
			<span class="mkt-nav__orb" aria-hidden="true">
				<i class="ti ti-chart-bar"></i>
			</span>
			<span class="brand-mark mkt-nav__wordmark">Statsman</span>
			<span class="mkt-nav__pulse" aria-hidden="true"></span>
		</a>

		<nav class="mkt-nav__links" aria-label="Primary">
			{#each links as link}
				{#if link.reload}
					<a href={link.href} class="mkt-nav__link" data-sveltekit-reload>
						<i class="ti {link.icon}" aria-hidden="true"></i>
						<span>{link.label}</span>
					</a>
				{:else}
					<a href={link.href} class="mkt-nav__link">
						<i class="ti {link.icon}" aria-hidden="true"></i>
						<span>{link.label}</span>
					</a>
				{/if}
			{/each}
		</nav>

		<div class="mkt-nav__actions">
			<ThemePicker compact />
			{#if authed}
				<a href="/dashboard" class="btn btn-sm btn-primary mkt-nav__cta">
					<i class="ti ti-layout-dashboard" aria-hidden="true"></i>
					<span>Dashboard</span>
				</a>
			{:else}
				<a href="/login" class="btn btn-sm btn-ghost mkt-nav__login">
					<i class="ti ti-login-2" aria-hidden="true"></i>
					<span>Log in</span>
				</a>
				<a href="/signup" class="btn btn-sm btn-primary mkt-nav__cta">
					<i class="ti ti-rocket" aria-hidden="true"></i>
					<span>Sign up</span>
				</a>
			{/if}
			<button
				type="button"
				class="mkt-nav__burger"
				aria-label={open ? 'Close menu' : 'Open menu'}
				aria-expanded={open}
				aria-controls="mkt-nav-drawer"
				onclick={toggle}
			>
				<span class="mkt-nav__burger-lines" class:open aria-hidden="true">
					<span></span>
					<span></span>
					<span></span>
				</span>
			</button>
		</div>
	</div>

	{#if open}
		<div
			id="mkt-nav-drawer"
			class="mkt-nav__drawer"
			role="dialog"
			aria-modal="true"
			aria-label="Site menu"
		>
			<div class="mkt-nav__drawer-glow" aria-hidden="true"></div>
			<nav class="mkt-nav__drawer-nav">
				{#each links as link, i}
					{#if link.reload}
						<a
							href={link.href}
							class="mkt-nav__drawer-link"
							style="--i: {i}"
							data-sveltekit-reload
							onclick={close}
						>
							<span class="mkt-nav__drawer-ico"><i class="ti {link.icon}"></i></span>
							<span class="mkt-nav__drawer-label">{link.label}</span>
							<i class="ti ti-arrow-right mkt-nav__drawer-arrow" aria-hidden="true"></i>
						</a>
					{:else}
						<a
							href={link.href}
							class="mkt-nav__drawer-link"
							style="--i: {i}"
							onclick={close}
						>
							<span class="mkt-nav__drawer-ico"><i class="ti {link.icon}"></i></span>
							<span class="mkt-nav__drawer-label">{link.label}</span>
							<i class="ti ti-arrow-right mkt-nav__drawer-arrow" aria-hidden="true"></i>
						</a>
					{/if}
				{/each}
			</nav>
			<div class="mkt-nav__drawer-foot">
				{#if authed}
					<a href="/dashboard" class="btn btn-primary w-full" onclick={close}>
						<i class="ti ti-layout-dashboard" aria-hidden="true"></i>
						Open dashboard
					</a>
				{:else}
					<a href="/signup" class="btn btn-primary w-full" onclick={close}>
						<i class="ti ti-rocket" aria-hidden="true"></i>
						Sign up free
					</a>
					<a href="/login" class="btn btn-ghost w-full" onclick={close}>
						<i class="ti ti-login-2" aria-hidden="true"></i>
						Log in
					</a>
				{/if}
			</div>
		</div>
	{/if}
</header>

<style>
	:global(html.nav-lock) {
		overflow: hidden;
	}

	.mkt-nav {
		position: sticky;
		top: 0.85rem;
		z-index: 50;
		margin-bottom: 3.25rem;
		isolation: isolate;
	}

	.mkt-nav__bar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.4rem 0.55rem 0.4rem 0.7rem;
		border-radius: 1.15rem;
		border: 1px solid color-mix(in oklab, var(--scifi-border) 80%, var(--scifi-primary) 20%);
		background: linear-gradient(
			145deg,
			rgba(var(--scifi-surface-1-rgb), 0.78) 0%,
			rgba(var(--scifi-surface-2-rgb), 0.62) 100%
		);
		backdrop-filter: blur(18px) saturate(1.25);
		-webkit-backdrop-filter: blur(18px) saturate(1.25);
		box-shadow:
			0 0 0 1px rgba(var(--scifi-primary-rgb), 0.08),
			0 18px 40px -22px rgba(var(--scifi-shadow-rgb), 0.75),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		transition:
			box-shadow 0.35s var(--scifi-ease),
			border-color 0.35s var(--scifi-ease),
			transform 0.35s var(--scifi-ease);
	}

	.mkt-nav--scrolled .mkt-nav__bar {
		box-shadow:
			0 0 0 1px rgba(var(--scifi-cyan-rgb), 0.12),
			0 22px 48px -18px rgba(var(--scifi-shadow-rgb), 0.85),
			0 0 28px -12px rgba(var(--scifi-primary-rgb), 0.35);
		border-color: color-mix(in oklab, var(--scifi-cyan) 35%, var(--scifi-border));
	}

	.mkt-nav__bar::after {
		content: '';
		position: absolute;
		inset: auto 12% -1px;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--scifi-primary),
			var(--scifi-cyan),
			transparent
		);
		opacity: 0.55;
		pointer-events: none;
	}

	.mkt-nav__brand {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		min-width: 0;
		padding: 0.2rem 0.35rem;
		border-radius: 0.75rem;
	}

	.mkt-nav__orb {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.65rem;
		background: linear-gradient(
			135deg,
			rgba(var(--scifi-primary-rgb), 0.22),
			rgba(var(--scifi-cyan-rgb), 0.12)
		);
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.35);
		color: var(--scifi-primary);
		font-size: 1.05rem;
		box-shadow: 0 0 18px -4px var(--scifi-primary-glow);
		flex-shrink: 0;
	}

	.mkt-nav__wordmark {
		font-size: 1.05rem;
		line-height: 1;
	}

	.mkt-nav__pulse {
		position: absolute;
		left: 0.55rem;
		top: 50%;
		width: 2rem;
		height: 2rem;
		border-radius: 0.65rem;
		transform: translateY(-50%);
		box-shadow: 0 0 0 0 rgba(var(--scifi-primary-rgb), 0.45);
		animation: mkt-pulse 2.8s ease-out infinite;
		pointer-events: none;
	}

	@keyframes mkt-pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(var(--scifi-primary-rgb), 0.4);
			opacity: 0.9;
		}
		70% {
			box-shadow: 0 0 0 12px rgba(var(--scifi-primary-rgb), 0);
			opacity: 0;
		}
		100% {
			opacity: 0;
		}
	}

	.mkt-nav__links {
		display: none;
		align-items: center;
		gap: 0.2rem;
	}

	.mkt-nav__link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.7rem;
		border-radius: 0.7rem;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--scifi-muted);
		transition:
			color 0.18s ease,
			background 0.18s ease,
			transform 0.18s ease;
	}

	.mkt-nav__link i {
		font-size: 0.95rem;
		opacity: 0.85;
	}

	.mkt-nav__link:hover {
		color: var(--scifi-primary);
		background: rgba(var(--scifi-primary-rgb), 0.1);
		transform: translateY(-1px);
	}

	.mkt-nav__actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.mkt-nav__login {
		display: none;
	}

	.mkt-nav__cta {
		display: none;
		gap: 0.35rem;
	}

	.mkt-nav__cta i,
	.mkt-nav__login i {
		font-size: 0.95rem;
	}

	.mkt-nav__burger {
		display: grid;
		place-items: center;
		width: 2.45rem;
		height: 2.45rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.28);
		background: rgba(var(--scifi-bg-deep-rgb), 0.45);
		color: var(--scifi-text);
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			box-shadow 0.2s ease;
	}

	.mkt-nav__burger:hover {
		border-color: var(--scifi-primary);
		box-shadow: 0 0 16px -6px var(--scifi-primary-glow);
	}

	.mkt-nav__burger-lines {
		position: relative;
		width: 1.05rem;
		height: 0.75rem;
	}

	.mkt-nav__burger-lines span {
		position: absolute;
		left: 0;
		right: 0;
		height: 1.5px;
		border-radius: 2px;
		background: currentColor;
		transition:
			transform 0.28s var(--scifi-ease),
			opacity 0.2s ease,
			top 0.28s var(--scifi-ease);
	}

	.mkt-nav__burger-lines span:nth-child(1) {
		top: 0;
	}
	.mkt-nav__burger-lines span:nth-child(2) {
		top: 50%;
		transform: translateY(-50%);
	}
	.mkt-nav__burger-lines span:nth-child(3) {
		bottom: 0;
	}

	.mkt-nav__burger-lines.open span:nth-child(1) {
		top: 50%;
		transform: translateY(-50%) rotate(45deg);
	}
	.mkt-nav__burger-lines.open span:nth-child(2) {
		opacity: 0;
	}
	.mkt-nav__burger-lines.open span:nth-child(3) {
		bottom: auto;
		top: 50%;
		transform: translateY(-50%) rotate(-45deg);
	}

	.mkt-nav__drawer {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 0.55rem);
		padding: 0.85rem;
		border-radius: 1.15rem;
		border: 1px solid color-mix(in oklab, var(--scifi-border) 70%, var(--scifi-cyan) 30%);
		background: linear-gradient(
			180deg,
			rgba(var(--scifi-surface-1-rgb), 0.96),
			rgba(var(--scifi-bg-deep-rgb), 0.94)
		);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		box-shadow:
			0 28px 60px -24px rgba(var(--scifi-shadow-rgb), 0.9),
			0 0 40px -20px rgba(var(--scifi-primary-rgb), 0.4);
		overflow: hidden;
		animation: mkt-drawer-in 0.32s var(--scifi-ease) both;
	}

	@keyframes mkt-drawer-in {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.mkt-nav__drawer-glow {
		position: absolute;
		inset: -40% -20% auto;
		height: 70%;
		background: radial-gradient(
			ellipse at 50% 0%,
			rgba(var(--scifi-primary-rgb), 0.22),
			transparent 65%
		);
		pointer-events: none;
	}

	.mkt-nav__drawer-nav {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.mkt-nav__drawer-link {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 0.95rem;
		border-radius: 0.9rem;
		text-decoration: none;
		color: var(--scifi-text);
		background: rgba(var(--scifi-bg-deep-rgb), 0.35);
		border: 1px solid transparent;
		animation: mkt-link-in 0.4s var(--scifi-ease) both;
		animation-delay: calc(var(--i) * 45ms);
		transition:
			border-color 0.18s ease,
			background 0.18s ease,
			transform 0.18s ease;
	}

	@keyframes mkt-link-in {
		from {
			opacity: 0;
			transform: translateX(-8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.mkt-nav__drawer-link:hover {
		border-color: rgba(var(--scifi-primary-rgb), 0.35);
		background: rgba(var(--scifi-primary-rgb), 0.1);
		transform: translateX(2px);
	}

	.mkt-nav__drawer-ico {
		display: grid;
		place-items: center;
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 0.7rem;
		background: rgba(var(--scifi-primary-rgb), 0.12);
		color: var(--scifi-primary);
		font-size: 1.15rem;
	}

	.mkt-nav__drawer-label {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.mkt-nav__drawer-arrow {
		color: var(--scifi-muted);
		font-size: 1rem;
	}

	.mkt-nav__drawer-foot {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-top: 0.85rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--scifi-border);
	}

	.mkt-nav__drawer-foot .btn {
		justify-content: center;
		gap: 0.45rem;
	}

	@media (min-width: 640px) {
		.mkt-nav__login {
			display: inline-flex;
			gap: 0.3rem;
		}
		.mkt-nav__cta {
			display: inline-flex;
		}
	}

	@media (min-width: 1024px) {
		.mkt-nav {
			margin-bottom: 4.5rem;
		}
		.mkt-nav__links {
			display: flex;
		}
		.mkt-nav__burger {
			display: none;
		}
		.mkt-nav__bar {
			padding: 0.45rem 0.65rem 0.45rem 0.85rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mkt-nav__pulse,
		.mkt-nav__drawer,
		.mkt-nav__drawer-link {
			animation: none;
		}
	}
</style>
