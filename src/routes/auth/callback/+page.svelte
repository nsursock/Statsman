<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let status = $state('Confirming your email…');
	let failed = $state(false);

	onMount(() => {
		void finishConfirm();
	});

	async function finishConfirm() {
		try {
			const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
			const search = new URLSearchParams(window.location.search);

			const type = hash.get('type') || search.get('type') || 'email';
			const next = data.next || '/dashboard';

			const access_token = hash.get('access_token') || '';
			const refresh_token = hash.get('refresh_token') || '';
			const token_hash = hash.get('token_hash') || search.get('token_hash') || '';
			const code = search.get('code') || hash.get('code') || '';
			const err =
				hash.get('error_description') ||
				hash.get('error') ||
				search.get('error_description') ||
				search.get('error') ||
				'';

			if (err) {
				await goto(`/login?error=${encodeURIComponent(err)}`, { replaceState: true });
				return;
			}

			// Recovery links sometimes land here with a hash session.
			if (type === 'recovery' && (token_hash || access_token)) {
				const q = new URLSearchParams({ type: 'recovery', next });
				if (token_hash) q.set('token_hash', token_hash);
				if (access_token) {
					// Preserve hash for /auth/reset client fallback
					window.location.replace(`/auth/reset?${q}#${hash.toString()}`);
					return;
				}
				window.location.replace(`/auth/reset?${q}`);
				return;
			}

			const body: Record<string, string> = { next };
			if (access_token) {
				body.access_token = access_token;
				if (refresh_token) body.refresh_token = refresh_token;
			} else if (code) {
				body.code = code;
			} else if (token_hash) {
				body.token_hash = token_hash;
				body.type = type;
			} else {
				await goto(
					`/login?error=${encodeURIComponent(
						'Email confirmed, but the link was incomplete. Sign in with your password.'
					)}&mode=login`,
					{ replaceState: true }
				);
				return;
			}

			status = 'Opening your console…';
			const res = await fetch('/api/auth/bridge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(payload.message || 'Could not finish confirmation');
			}

			// Drop sensitive hash before navigating.
			window.history.replaceState({}, '', window.location.pathname + window.location.search);
			window.location.replace(payload.next || next);
		} catch (e) {
			failed = true;
			status = e instanceof Error ? e.message : 'Confirmation failed';
		}
	}
</script>

<svelte:head>
	<title>Confirming — Statsman</title>
</svelte:head>

<main class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)] flex items-center justify-center p-6">
	<div class="console-panel max-w-md w-full">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Email confirm</span>
			{#if !failed}
				<span class="status-chip"><span class="dot"></span> verifying</span>
			{/if}
		</div>
		<div class="p-5 space-y-4">
			<p class="text-sm m-0 {failed ? 'text-[var(--scifi-error)]' : 'text-scifi-muted'}">{status}</p>
			{#if failed}
				<a href="/login?mode=login" class="btn-cta w-full text-center no-underline inline-block"
					>Go to sign in</a
				>
			{/if}
		</div>
	</div>
</main>
