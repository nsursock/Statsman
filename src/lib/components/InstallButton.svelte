<script lang="ts">
	import { pwa, promptInstall } from '$lib/pwa.svelte';

	// Show the button only when an install is actually possible:
	//   - iOS: no programmatic prompt, so we show step-by-step instructions instead.
	//   - Chrome/Android/desktop: only when the browser has fired beforeinstallprompt.
	//   - Already installed (standalone mode): show an "Installed" confirmation instead.
	const canInstall = $derived(!pwa.installed && (pwa.isIOS || pwa.deferred !== null));

	let iosOpen = $state(false);

	function onClick() {
		if (pwa.isIOS) {
			iosOpen = true;
			return;
		}
		void promptInstall();
	}

	function closeIos() {
		iosOpen = false;
	}
</script>

{#if pwa.installed}
	<div class="install-state install-state--done">
		<i class="ti ti-check" aria-hidden="true"></i>
		<span>Installed</span>
	</div>
{:else if canInstall}
	<button type="button" class="install-btn" onclick={onClick}>
		<i class="ti ti-device-mobile" aria-hidden="true"></i>
		<span>{pwa.isIOS ? 'Install on Home Screen' : 'Install app'}</span>
	</button>
{/if}

{#if iosOpen}
	<!-- iOS has no install API; walk the user through Share → Add to Home Screen. -->
	<div
		class="ios-backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeIos();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeIos();
		}}
	>
		<div class="ios-sheet" role="dialog" aria-modal="true" aria-labelledby="ios-title">
			<header class="ios-head">
				<h3 id="ios-title" class="m-0 text-base font-bold tracking-tight">Install Statsman</h3>
				<button type="button" class="ios-close" onclick={closeIos} aria-label="Close">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</header>

			<ol class="ios-steps">
				<li>
					<span class="ios-step-num">1</span>
					<span class="ios-step-copy">
						Tap the
						<span class="ios-share">
							<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5"/></svg>
							Share
						</span>
						button in Safari's toolbar.
					</span>
				</li>
				<li>
					<span class="ios-step-num">2</span>
					<span class="ios-step-copy">Scroll and tap <strong>Add to Home Screen</strong>.</span>
				</li>
				<li>
					<span class="ios-step-num">3</span>
					<span class="ios-step-copy">Tap <strong>Add</strong> — Statsman launches like a native app.</span>
				</li>
			</ol>

			<button type="button" class="btn btn-primary w-full" onclick={closeIos}>Got it</button>
		</div>
	</div>
{/if}

<style>
	.install-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.85rem;
		border-radius: 0.6rem;
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.45);
		background: linear-gradient(
			135deg,
			rgba(var(--scifi-primary-rgb), 0.18),
			rgba(var(--scifi-cyan-rgb), 0.08)
		);
		color: var(--scifi-text);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			transform 0.18s ease;
	}
	.install-btn:hover {
		border-color: rgba(var(--scifi-primary-rgb), 0.7);
		box-shadow: 0 0 18px -6px var(--scifi-primary-glow);
		transform: translateY(-1px);
	}
	.install-btn i {
		color: var(--scifi-primary);
		font-size: 1rem;
	}

	.install-state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.85rem;
		border-radius: 0.6rem;
		border: 1px solid rgba(var(--scifi-success-rgb), 0.5);
		background: rgba(var(--scifi-success-rgb), 0.1);
		color: var(--scifi-success);
		font-size: 0.78rem;
		font-weight: 600;
	}
	.install-state i {
		font-size: 1rem;
	}

	.ios-backdrop {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 0;
		background: rgba(var(--scifi-backdrop-rgb), 0.7);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: ios-fade 0.2s var(--scifi-ease, ease-out);
	}

	.ios-sheet {
		width: 100%;
		max-width: 30rem;
		padding: 1.1rem 1.1rem max(1.1rem, env(safe-area-inset-bottom));
		border-radius: 14px 14px 0 0;
		border: 1px solid var(--scifi-border-accent);
		border-bottom: 0;
		background: linear-gradient(
			165deg,
			rgba(var(--scifi-surface-1-rgb), 0.98),
			rgba(var(--scifi-surface-2-rgb), 0.99)
		);
		box-shadow: 0 -16px 48px -12px rgba(var(--scifi-shadow-rgb), 0.7);
		animation: ios-rise 0.28s var(--scifi-ease, ease-out);
	}

	.ios-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.ios-close {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.6rem;
		border: 1px solid var(--scifi-border);
		background: rgba(var(--scifi-bg-deep-rgb), 0.4);
		color: var(--scifi-text);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.ios-close:hover {
		border-color: rgba(var(--scifi-primary-rgb), 0.45);
		background: rgba(var(--scifi-primary-rgb), 0.08);
	}

	.ios-steps {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.ios-steps li {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
	}
	.ios-step-num {
		display: grid;
		place-items: center;
		width: 1.65rem;
		height: 1.65rem;
		flex-shrink: 0;
		border-radius: 999px;
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.4);
		background: rgba(var(--scifi-primary-rgb), 0.12);
		color: var(--scifi-primary);
		font-size: 0.72rem;
		font-weight: 700;
	}
	.ios-step-copy {
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--scifi-text);
		padding-top: 0.15rem;
	}
	.ios-step-copy strong {
		color: var(--scifi-cyan);
		font-weight: 600;
	}
	.ios-share {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.1rem 0.4rem;
		border-radius: 0.35rem;
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.35);
		background: rgba(var(--scifi-primary-rgb), 0.08);
		color: var(--scifi-primary);
		font-weight: 600;
		font-size: 0.78rem;
	}
	.ios-share svg {
		flex-shrink: 0;
	}

	@keyframes ios-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes ios-rise {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (min-width: 640px) {
		.ios-backdrop {
			align-items: center;
			padding: 1rem;
		}
		.ios-sheet {
			border-radius: 14px;
			border-bottom: 1px solid var(--scifi-border-accent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ios-backdrop,
		.ios-sheet,
		.install-btn:hover {
			animation: none;
			transform: none;
		}
	}
</style>
