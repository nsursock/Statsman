<script lang="ts">
	import { onMount } from 'svelte';
	import { enterShell } from '@scifiui/core/js';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let root: HTMLElement;
	let password = $state('');
	let confirm = $state('');
	let busy = $state(false);
	let errorMsg = $state('');
	let tokenHash = $state(data.tokenHash);
	let otpType = $state(data.type);

	onMount(() => {
		enterShell(root);
		if (!tokenHash && typeof window !== 'undefined') {
			const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
			const th = hash.get('token_hash');
			const t = hash.get('type');
			if (th) tokenHash = th;
			if (t) otpType = t;
		}
	});

	async function submit(e: Event) {
		e.preventDefault();
		errorMsg = '';
		if (password.length < 8) {
			errorMsg = 'Password must be at least 8 characters';
			return;
		}
		if (password !== confirm) {
			errorMsg = 'Passwords do not match';
			return;
		}
		if (!tokenHash) {
			errorMsg = 'Missing reset token — open the link from your email again.';
			return;
		}
		busy = true;
		try {
			const res = await fetch('/api/auth/update-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					password,
					token_hash: tokenHash,
					type: otpType || 'recovery',
					next: data.next
				})
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not update password');
			window.location.href = payload.next || '/dashboard';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Could not update password';
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Reset password — Statsman</title>
</svelte:head>

<main
	bind:this={root}
	class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)] relative overflow-x-hidden"
>
	<div class="absolute top-4 right-4 z-20">
		<ThemePicker compact />
	</div>
	<div class="relative z-10 mx-auto max-w-md px-4 py-16">
		<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
		<p class="label-kicker text-scifi-primary mt-8 mb-2">// Password reset</p>
		<h1 class="text-3xl font-extrabold tracking-tight mb-6">Choose a new password</h1>

		{#if !data.authConfigured}
			<p class="text-sm text-[var(--scifi-error)]">Supabase Auth is not configured on this instance.</p>
		{:else}
			<form class="console-panel p-5 space-y-4" onsubmit={submit}>
				<label class="block space-y-1.5">
					<span class="label-kicker">New password</span>
					<input
						class="input w-full"
						type="password"
						bind:value={password}
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</label>
				<label class="block space-y-1.5">
					<span class="label-kicker">Confirm</span>
					<input
						class="input w-full"
						type="password"
						bind:value={confirm}
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</label>
				{#if errorMsg}
					<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
				{/if}
				<button class="btn-cta w-full" type="submit" disabled={busy}>
					{busy ? 'Saving…' : 'Save password & sign in'}
				</button>
			</form>
		{/if}
	</div>
</main>
