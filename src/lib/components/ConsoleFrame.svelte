<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		header
	}: {
		children: Snippet;
		header?: Snippet;
	} = $props();
</script>

<div class="dash relative min-h-screen overflow-x-hidden bg-[var(--scifi-bg)] text-[var(--scifi-text)]">
	<div class="dash-atmosphere" aria-hidden="true">
		<div class="dash-grid"></div>
		<div class="dash-glow"></div>
		<div class="dash-vignette"></div>
	</div>

	<div class="relative z-10 mx-auto max-w-7xl px-3 sm:px-4 pt-3 sm:pt-4 pb-10">
		{#if header}
			{@render header()}
		{/if}
		{@render children()}
	</div>
</div>

<style>
	.dash-atmosphere {
		pointer-events: none;
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
	}
	.dash-grid {
		position: absolute;
		inset: 0;
		opacity: 0.35;
		background-image:
			linear-gradient(rgba(var(--scifi-primary-rgb), 0.06) 1px, transparent 1px),
			linear-gradient(90deg, rgba(var(--scifi-primary-rgb), 0.06) 1px, transparent 1px);
		background-size: 48px 48px;
		mask-image: radial-gradient(ellipse 70% 55% at 50% 0%, #000 20%, transparent 75%);
	}
	.dash-glow {
		position: absolute;
		top: -20%;
		left: 20%;
		width: 55%;
		height: 45%;
		background: radial-gradient(ellipse, rgba(var(--scifi-primary-rgb), 0.16), transparent 70%);
		filter: blur(8px);
	}
	.dash-vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at center,
			transparent 40%,
			rgba(var(--scifi-bg-deep-rgb), 0.55) 100%
		);
	}

	/* Shared chrome — used by dashboard + demo command bars */
	:global(.command-bar) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.65rem 0.85rem;
		border-radius: 14px;
		border: 1px solid var(--scifi-border-accent);
		background: linear-gradient(
			165deg,
			rgba(var(--scifi-surface-1-rgb), 0.88),
			rgba(var(--scifi-surface-2-rgb), 0.92)
		);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 12px 40px -18px rgba(var(--scifi-shadow-rgb), 0.55);
	}

	:global(.live-toggle) {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.65rem;
		border-radius: 999px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.4);
		color: var(--scifi-muted);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			color 0.18s ease,
			box-shadow 0.18s ease;
	}
	:global(.live-toggle.is-live) {
		color: var(--scifi-success);
		border-color: rgba(var(--scifi-success-rgb), 0.45);
		box-shadow: 0 0 16px rgba(var(--scifi-success-rgb), 0.15);
	}
	:global(.live-dot) {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--scifi-muted);
	}
	:global(.live-toggle.is-live .live-dot) {
		background: var(--scifi-success);
		box-shadow: 0 0 8px rgba(var(--scifi-success-rgb), 0.8);
		animation: live-blink 1.4s ease-in-out infinite;
	}

	:global(.range-seg) {
		display: inline-flex;
		padding: 0.2rem;
		gap: 0.15rem;
		border-radius: 10px;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.35);
	}
	:global(.range-btn) {
		border: 0;
		border-radius: 7px;
		padding: 0.28rem 0.55rem;
		font-size: 0.68rem;
		font-weight: 650;
		letter-spacing: 0.04em;
		color: var(--scifi-muted);
		background: transparent;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}
	:global(.range-btn.is-active) {
		color: var(--scifi-active-text, var(--scifi-text));
		background: linear-gradient(
			135deg,
			rgba(var(--scifi-primary-rgb), 0.35),
			rgba(var(--scifi-cyan-rgb), 0.15)
		);
		box-shadow: 0 0 12px rgba(var(--scifi-primary-rgb), 0.2);
	}

	@keyframes live-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.live-toggle.is-live .live-dot) {
			animation: none;
		}
	}
</style>
