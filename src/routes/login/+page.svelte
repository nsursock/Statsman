<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enterShell } from '@scifiui/core/js';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mode = $state<'login' | 'signup'>('login');
	let email = $state('');
	let adminToken = $state('');
	let status = $state('');
	let errorMsg = $state('');
	let devLink = $state<string | null>(null);
	let busy = $state(false);
	let sent = $state(false);
	let root: HTMLElement;

	onMount(() => {
		mode = data.mode === 'signup' ? 'signup' : 'login';
		enterShell(root);
	});

	$effect(() => {
		mode = data.mode === 'signup' ? 'signup' : 'login';
	});

	function setMode(next: 'login' | 'signup') {
		mode = next;
		status = '';
		errorMsg = '';
		sent = false;
		devLink = null;
		goto(`/login?mode=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function submit(e: Event) {
		e.preventDefault();
		busy = true;
		status = '';
		errorMsg = '';
		devLink = null;
		try {
			const body = data.isCloud
				? { email }
				: data.needsAdminToken
					? { adminToken }
					: data.openSelfhost
						? { openAccess: true }
						: { email };
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Request failed');
			if (payload.mode === 'admin' || payload.mode === 'open') {
				window.location.href = '/dashboard';
				return;
			}
			sent = true;
			status =
				mode === 'signup'
					? 'Account ready — check your email for the magic link.'
					: 'Check your email for the magic link.';
			if (payload.devLink) {
				devLink = payload.devLink;
				status = 'Dev mode: email is not configured — use the link below.';
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}

	async function enterOpenSelfhost() {
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ openAccess: true })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not enter console');
			window.location.href = '/dashboard';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{mode === 'signup' ? 'Create account' : 'Log in'} — Statsman</title>
</svelte:head>

<main
	bind:this={root}
	class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)] relative overflow-x-hidden"
>
	<div class="absolute top-4 right-4 z-20">
		<ThemePicker compact />
	</div>

	<div class="relative z-10 mx-auto max-w-6xl min-h-screen grid lg:grid-cols-2">
		<!-- Brand panel -->
		<section
			class="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-[var(--scifi-border)]"
			data-enter
		>
			<div class="grid-floor opacity-30"></div>
			<div class="relative z-10">
				<a href="/" class="brand-mark text-xl no-underline">Statsman</a>
				<p class="label-kicker text-scifi-primary mt-8 mb-3">
					{mode === 'signup' ? '// New transmission' : '// Welcome back'}
				</p>
				<h1 class="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
					{#if mode === 'signup'}
						Own your signal<br /><span class="text-scifi-primary glow-text">in sixty seconds.</span>
					{:else}
						Resume the<br /><span class="text-scifi-primary glow-text">console.</span>
					{/if}
				</h1>
				<p class="text-scifi-muted text-sm leading-relaxed max-w-md">
					Cookieless analytics for indie blogs. Magic-link auth, no password to forget, no cookie
					banner to apologize for.
				</p>
			</div>
			<ul class="relative z-10 space-y-3 text-sm text-scifi-muted list-none p-0 m-0">
				<li class="flex gap-2 items-baseline"><span class="text-scifi-primary">▸</span> Free tier · 1 site · 3k views/mo</li>
				<li class="flex gap-2 items-baseline"><span class="text-scifi-primary">▸</span> Self-host forever on Docker · MIT</li>
				<li class="flex gap-2 items-baseline"><span class="text-scifi-primary">▸</span> Upgrade only when you outgrow free</li>
			</ul>
		</section>

		<!-- Form panel -->
		<section class="flex flex-col justify-center p-6 sm:p-10 xl:p-14" data-enter>
			<div class="mb-8 lg:hidden">
				<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
			</div>

			{#if data.isCloud}
				<div class="glass rounded-lg p-1 flex gap-1 mb-6 max-w-md">
					<button
						type="button"
						class="btn btn-sm flex-1 border-0 {mode === 'signup' ? 'btn-primary' : 'btn-ghost'}"
						onclick={() => setMode('signup')}
					>
						Sign up
					</button>
					<button
						type="button"
						class="btn btn-sm flex-1 border-0 {mode === 'login' ? 'btn-primary' : 'btn-ghost'}"
						onclick={() => setMode('login')}
					>
						Log in
					</button>
				</div>

				{#if sent}
					<div class="console-panel max-w-md">
						<div class="pane-header">
							<span class="pane-title"><span class="pane-title-bar"></span> Link dispatched</span>
							<span class="status-chip"><span class="dot"></span> inbox</span>
						</div>
						<div class="p-5 space-y-4">
							<p class="text-sm leading-relaxed m-0">
								We sent a magic link to
								<span class="text-scifi-cyan">{email}</span>. It expires in 15 minutes.
							</p>
							<p class="text-scifi-muted text-xs m-0">{status}</p>
							{#if devLink}
								<a class="btn btn-primary w-full text-center" href={devLink}>Open magic link</a>
							{/if}
							<button
								type="button"
								class="btn btn-ghost w-full"
								onclick={() => {
									sent = false;
									status = '';
									devLink = null;
								}}
							>
								Use a different email
							</button>
						</div>
					</div>
				{:else}
					<div class="console-panel max-w-md">
						<div class="pane-header">
							<span class="pane-title">
								<span class="pane-title-bar"></span>
								{mode === 'signup' ? 'Create account' : 'Log in'}
							</span>
						</div>
						<form class="p-5 space-y-4" onsubmit={submit}>
							<p class="text-scifi-muted text-sm m-0 leading-relaxed">
								{#if mode === 'signup'}
									Enter your email. We’ll create a free account and send a one-tap sign-in link —
									no password.
								{:else}
									Enter the email on your account. We’ll email a one-tap magic link — no password.
								{/if}
							</p>
							<label class="block space-y-1.5">
								<span class="label-kicker">Email</span>
								<input
									class="input w-full"
									type="email"
									bind:value={email}
									required
									autocomplete="email"
									placeholder="you@indie.dev"
								/>
							</label>
							{#if errorMsg}
								<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
							{/if}
							<button class="btn-cta w-full" type="submit" disabled={busy}>
								{busy ? 'Sending…' : mode === 'signup' ? 'Create free account' : 'Email magic link'}
							</button>
							<p class="text-[0.68rem] tracking-[0.08em] uppercase text-scifi-muted/70 m-0 text-center">
								No credit card · Cancel anytime
							</p>
						</form>
					</div>
				{/if}
			{:else if data.needsAdminToken}
				<div class="console-panel max-w-md">
					<div class="pane-header">
						<span class="pane-title"><span class="pane-title-bar"></span> Self-host unlock</span>
						<span class="badge badge-primary">admin</span>
					</div>
					<form class="p-5 space-y-4" onsubmit={submit}>
						<p class="text-scifi-muted text-sm m-0 leading-relaxed">
							This console is locked. Enter the
							<code class="text-scifi-cyan">ADMIN_TOKEN</code> from your environment to continue.
						</p>
						<label class="block space-y-1.5">
							<span class="label-kicker">Admin token</span>
							<input
								class="input w-full"
								type="password"
								bind:value={adminToken}
								required
								autocomplete="current-password"
								placeholder="••••••••••••"
							/>
						</label>
						{#if errorMsg}
							<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
						{/if}
						<button class="btn-cta w-full" type="submit" disabled={busy}>
							{busy ? 'Unlocking…' : 'Unlock console'}
						</button>
					</form>
				</div>
			{:else}
				<div class="console-panel max-w-md">
					<div class="pane-header">
						<span class="pane-title"><span class="pane-title-bar"></span> Self-host · open</span>
						<span class="status-chip"><span class="dot"></span> local</span>
					</div>
					<div class="p-5 space-y-4">
						<p class="text-scifi-muted text-sm m-0 leading-relaxed">
							No <code class="text-scifi-cyan">ADMIN_TOKEN</code> is set — enter once to unlock this
							machine’s console. Logout clears access until you enter again. Lock later with an env
							token if you want.
						</p>
						{#if errorMsg}
							<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
						{/if}
						<button class="btn-cta w-full" type="button" disabled={busy} onclick={enterOpenSelfhost}>
							{busy ? 'Entering…' : 'Enter console'}
						</button>
					</div>
				</div>
			{/if}

			<p class="mt-6 text-xs text-scifi-muted max-w-md">
				{#if data.isCloud}
					<a href="/" class="text-scifi-cyan no-underline hover:text-scifi-primary">← Back to home</a>
					<span class="mx-2 opacity-40">·</span>
					<a href="/pricing" class="no-underline hover:text-scifi-primary">Pricing</a>
				{:else}
					<span>Self-hosted Statsman · operator console</span>
				{/if}
			</p>
		</section>
	</div>
</main>
