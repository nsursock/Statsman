<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { enterShell } from '@scifiui/core/js';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mode = $state<'login' | 'signup'>('login');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let adminToken = $state('');
	let status = $state('');
	let errorMsg = $state('');
	let busy = $state(false);
	let sent = $state(false);
	let showReset = $state(false);
	let root: HTMLElement;

	const showLogin = $derived(mode === 'login');

	onMount(() => {
		mode = data.mode === 'signup' ? 'signup' : 'login';
		enterShell(root);
	});

	$effect(() => {
		mode = data.mode === 'signup' ? 'signup' : 'login';
	});

	$effect(() => {
		errorMsg = data.authError || '';
	});

	function loginHref(m: 'login' | 'signup') {
		const q = new URLSearchParams({ mode: m });
		if (data.next) q.set('next', data.next);
		return `/login?${q}`;
	}

	function setMode(nextMode: 'login' | 'signup') {
		mode = nextMode;
		status = '';
		errorMsg = '';
		sent = false;
		showReset = false;
		goto(loginHref(nextMode), { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function submit(e: Event) {
		e.preventDefault();
		busy = true;
		status = '';
		errorMsg = '';
		try {
			if (!data.isCloud) {
				const body = data.needsAdminToken ? { adminToken } : { openAccess: true };
				const res = await fetch('/api/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				const payload = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(payload.message || 'Request failed');
				window.location.href = data.next || '/dashboard';
				return;
			}

			if (!data.authConfigured) {
				throw new Error('Supabase Auth is not configured on this instance.');
			}

			if (showReset) {
				const res = await fetch('/api/auth/reset', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email })
				});
				const payload = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(payload.message || 'Could not send reset email');
				sent = true;
				status = payload.message || 'Check your email for a reset link.';
				return;
			}

			if (mode === 'signup') {
				if (password !== confirmPassword) {
					throw new Error('Passwords do not match');
				}
				const res = await fetch('/api/auth/signup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, next: data.next })
				});
				const payload = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(payload.message || 'Signup failed');
				if (payload.confirmed) {
					window.location.href = payload.next || data.next || '/dashboard';
					return;
				}
				sent = true;
				status = payload.message || 'Check your email to confirm your account.';
				return;
			}

			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, next: data.next })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Login failed');
			window.location.href = payload.next || data.next || '/dashboard';
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
			window.location.href = data.next || '/dashboard';
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
	<div class="absolute top-4 right-4 z-30">
		<ThemePicker compact />
	</div>

	{#if data.isCloud}
		<!-- Track Record–style sliding login / signup panels -->
		<section class="grid lg:grid-cols-2 min-h-screen relative overflow-hidden">
			<!-- Forms column (slides right on login) -->
			<div
				class="relative w-full min-h-screen lg:transition-transform lg:duration-[600ms] lg:ease-in-out {showLogin
					? 'lg:translate-x-full'
					: ''}"
			>
				{#if !showLogin}
					<div
						class="absolute inset-0 w-full h-full flex items-center justify-center overflow-y-auto"
						in:fade={{ duration: 280 }}
						out:fade={{ duration: 220 }}
					>
						<div class="w-full max-w-md px-4 py-10 sm:px-6 lg:px-8">
							<div class="mb-8 lg:hidden text-center">
								<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
							</div>
							<div class="text-center mb-6">
								<p class="label-kicker text-scifi-primary mb-2">// New transmission</p>
								<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight m-0">
									Create your account
								</h1>
								<p class="mt-2 text-sm text-scifi-muted m-0">
									Cookieless analytics for indie blogs — free during beta.
								</p>
							</div>

							{#if sent}
								<div class="console-panel">
									<div class="pane-header">
										<span class="pane-title"><span class="pane-title-bar"></span> Check your email</span>
										<span class="status-chip"><span class="dot"></span> inbox</span>
									</div>
									<div class="p-5 space-y-4">
										<p class="text-sm leading-relaxed m-0">{status}</p>
										<p class="text-scifi-muted text-xs m-0">
											Sent to <span class="text-scifi-cyan">{email}</span>
										</p>
										<button
											type="button"
											class="btn btn-ghost w-full"
											onclick={() => {
												sent = false;
												status = '';
											}}
										>
											Back
										</button>
									</div>
								</div>
							{:else}
								<div class="console-panel">
									<div class="pane-header">
										<span class="pane-title"><span class="pane-title-bar"></span> Sign up</span>
									</div>
									<form class="p-5 space-y-4" onsubmit={submit}>
										{#if !data.authConfigured}
											<p class="text-sm text-[var(--scifi-error)] m-0">
												Supabase Auth is not configured. Set
												<code class="text-scifi-cyan">SUPABASE_URL</code> and
												<code class="text-scifi-cyan">SUPABASE_PUBLISHABLE_KEY</code>.
											</p>
										{/if}
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
										<label class="block space-y-1.5">
											<span class="label-kicker">Password</span>
											<input
												class="input w-full"
												type="password"
												bind:value={password}
												required
												minlength="8"
												autocomplete="new-password"
												placeholder="••••••••"
											/>
										</label>
										<label class="block space-y-1.5">
											<span class="label-kicker">Confirm password</span>
											<input
												class="input w-full"
												type="password"
												bind:value={confirmPassword}
												required
												minlength="8"
												autocomplete="new-password"
												placeholder="••••••••"
											/>
										</label>
										{#if errorMsg}
											<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
										{/if}
										<button class="btn-cta w-full" type="submit" disabled={busy || !data.authConfigured}>
											{busy ? 'Working…' : 'Create free account'}
										</button>
										<p class="text-center text-xs text-scifi-muted m-0">
											Already have an account?
											<button
												type="button"
												class="text-scifi-cyan hover:text-scifi-primary underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer"
												onclick={() => setMode('login')}
											>
												Log in
											</button>
										</p>
										<p
											class="text-[0.68rem] tracking-[0.08em] uppercase text-scifi-muted/70 m-0 text-center"
										>
											Free beta · No credit card
										</p>
									</form>
								</div>
							{/if}

							<p class="mt-6 text-xs text-scifi-muted text-center lg:text-left">
								<a href="/" class="text-scifi-cyan no-underline hover:text-scifi-primary">← Back to home</a>
								<span class="mx-2 opacity-40">·</span>
								<a href="/pricing" class="no-underline hover:text-scifi-primary">Pricing</a>
							</p>
						</div>
					</div>
				{/if}

				{#if showLogin}
					<div
						class="absolute inset-0 w-full h-full flex items-center justify-center overflow-y-auto"
						in:fade={{ duration: 280 }}
						out:fade={{ duration: 220 }}
					>
						<div class="w-full max-w-md px-4 py-10 sm:px-6 lg:px-8">
							<div class="mb-8 lg:hidden text-center">
								<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
							</div>
							<div class="text-center mb-6">
								<p class="label-kicker text-scifi-primary mb-2">// Welcome back</p>
								<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight m-0">
									{showReset ? 'Reset password' : 'Resume the console'}
								</h1>
								<p class="mt-2 text-sm text-scifi-muted m-0">
									{#if showReset}
										We’ll email you a secure reset link.
									{:else}
										Sign in with email and password.
									{/if}
								</p>
							</div>

							{#if sent}
								<div class="console-panel">
									<div class="pane-header">
										<span class="pane-title"><span class="pane-title-bar"></span> Check your email</span>
										<span class="status-chip"><span class="dot"></span> inbox</span>
									</div>
									<div class="p-5 space-y-4">
										<p class="text-sm leading-relaxed m-0">{status}</p>
										<p class="text-scifi-muted text-xs m-0">
											Sent to <span class="text-scifi-cyan">{email}</span>
										</p>
										<button
											type="button"
											class="btn btn-ghost w-full"
											onclick={() => {
												sent = false;
												status = '';
												showReset = false;
											}}
										>
											Back
										</button>
									</div>
								</div>
							{:else}
								<div class="console-panel">
									<div class="pane-header">
										<span class="pane-title">
											<span class="pane-title-bar"></span>
											{showReset ? 'Reset password' : 'Log in'}
										</span>
									</div>
									<form class="p-5 space-y-4" onsubmit={submit}>
										{#if !data.authConfigured}
											<p class="text-sm text-[var(--scifi-error)] m-0">
												Supabase Auth is not configured. Set
												<code class="text-scifi-cyan">SUPABASE_URL</code> and
												<code class="text-scifi-cyan">SUPABASE_PUBLISHABLE_KEY</code>.
											</p>
										{/if}
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
										{#if !showReset}
											<label class="block space-y-1.5">
												<span class="label-kicker">Password</span>
												<input
													class="input w-full"
													type="password"
													bind:value={password}
													required
													minlength="8"
													autocomplete="current-password"
													placeholder="••••••••"
												/>
											</label>
											<div class="flex justify-end">
												<button
													type="button"
													class="text-xs text-scifi-cyan hover:text-scifi-primary bg-transparent border-0 p-0 cursor-pointer"
													onclick={() => {
														showReset = true;
														errorMsg = '';
													}}
												>
													Forgot password?
												</button>
											</div>
										{/if}
										{#if errorMsg}
											<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
										{/if}
										<button class="btn-cta w-full" type="submit" disabled={busy || !data.authConfigured}>
											{#if busy}
												Working…
											{:else if showReset}
												Send reset link
											{:else}
												Sign in
											{/if}
										</button>
										{#if showReset}
											<button
												type="button"
												class="btn btn-ghost w-full btn-sm"
												onclick={() => {
													showReset = false;
													errorMsg = '';
												}}
											>
												Back to sign in
											</button>
										{:else}
											<p class="text-center text-xs text-scifi-muted m-0">
												Don’t have an account?
												<button
													type="button"
													class="text-scifi-cyan hover:text-scifi-primary underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer"
													onclick={() => setMode('signup')}
												>
													Sign up
												</button>
											</p>
										{/if}
									</form>
								</div>
							{/if}

							<p class="mt-6 text-xs text-scifi-muted text-center lg:text-left">
								<a href="/" class="text-scifi-cyan no-underline hover:text-scifi-primary">← Back to home</a>
								<span class="mx-2 opacity-40">·</span>
								<a href="/pricing" class="no-underline hover:text-scifi-primary">Pricing</a>
							</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Overlay column (slides left on login) — desktop only -->
			<div
				class="hidden lg:block relative w-full min-h-screen lg:transition-transform lg:duration-[600ms] lg:ease-in-out {showLogin
					? 'lg:-translate-x-full'
					: ''}"
			>
				{#if !showLogin}
					<div
						class="absolute inset-0 w-full h-full"
						in:fade={{ duration: 280 }}
						out:fade={{ duration: 220 }}
					>
						<div
							class="relative h-full flex items-center justify-center p-12 border-l border-[var(--scifi-border)]"
						>
							<div class="grid-floor opacity-30"></div>
							<div class="relative z-10 max-w-lg text-center">
								<a href="/" class="brand-mark text-xl no-underline">Statsman</a>
								<h2 class="text-3xl xl:text-4xl font-extrabold tracking-tight mt-8 mb-4 leading-tight">
									Own your signal<br />
									<span class="text-scifi-primary glow-text">in sixty seconds.</span>
								</h2>
								<p class="text-scifi-muted text-sm leading-relaxed mb-8 m-0">
									Paste one tracker snippet. See pageviews without cookies or adtech.
								</p>
								<ul class="space-y-3 text-sm text-scifi-muted list-none p-0 m-0 text-left max-w-sm mx-auto">
									<li class="flex gap-2 items-baseline">
										<span class="text-scifi-primary">▸</span> Free cloud beta · no card
									</li>
									<li class="flex gap-2 items-baseline">
										<span class="text-scifi-primary">▸</span> Self-host forever on Docker · MIT
									</li>
									<li class="flex gap-2 items-baseline">
										<span class="text-scifi-primary">▸</span> Email confirm + password reset
									</li>
								</ul>
							</div>
						</div>
					</div>
				{/if}

				{#if showLogin}
					<div
						class="absolute inset-0 w-full h-full"
						in:fade={{ duration: 280 }}
						out:fade={{ duration: 220 }}
					>
						<div
							class="relative h-full flex items-center justify-center p-12 border-r border-[var(--scifi-border)]"
						>
							<div class="grid-floor opacity-30"></div>
							<div class="relative z-10 max-w-lg text-center">
								<a href="/" class="brand-mark text-xl no-underline">Statsman</a>
								<h2 class="text-3xl xl:text-4xl font-extrabold tracking-tight mt-8 mb-4 leading-tight">
									Continue the<br />
									<span class="text-scifi-primary glow-text">console.</span>
								</h2>
								<p class="text-scifi-muted text-sm leading-relaxed mb-8 m-0">
									Your sites, plans, and tracker snippets wait behind one password — same
									privacy-first stack as self-host.
								</p>
								<ul class="space-y-3 text-sm text-scifi-muted list-none p-0 m-0 text-left max-w-sm mx-auto">
									<li class="flex gap-2 items-baseline">
										<span class="text-scifi-primary">▸</span> Multi-site cloud console
									</li>
									<li class="flex gap-2 items-baseline">
										<span class="text-scifi-primary">▸</span> Cookieless pageviews · ScifiUI
									</li>
									<li class="flex gap-2 items-baseline">
										<span class="text-scifi-primary">▸</span> Self-host anytime
									</li>
								</ul>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>
	{:else}
		<!-- Self-host: simple unlock (no login/signup slide) -->
		<div class="relative z-10 mx-auto max-w-6xl min-h-screen grid lg:grid-cols-2">
			<section
				class="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-[var(--scifi-border)]"
				data-enter
			>
				<div class="grid-floor opacity-30"></div>
				<div class="relative z-10">
					<a href="/" class="brand-mark text-xl no-underline">Statsman</a>
					<p class="label-kicker text-scifi-primary mt-8 mb-3">// Operator console</p>
					<h1 class="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
						Unlock your<br /><span class="text-scifi-primary glow-text">self-host console.</span>
					</h1>
					<p class="text-scifi-muted text-sm leading-relaxed max-w-md">
						This instance is yours — no Stripe, no plan caps. Unlock with your admin token (or open
						access if none is set).
					</p>
				</div>
				<ul class="relative z-10 space-y-3 text-sm text-scifi-muted list-none p-0 m-0">
					<li class="flex gap-2 items-baseline">
						<span class="text-scifi-primary">▸</span> SQLite volume or your Postgres
					</li>
					<li class="flex gap-2 items-baseline">
						<span class="text-scifi-primary">▸</span> Practical unlimited sites &amp; views
					</li>
					<li class="flex gap-2 items-baseline">
						<span class="text-scifi-primary">▸</span> Same tracker.js as cloud
					</li>
				</ul>
			</section>

			<section class="flex flex-col justify-center p-6 sm:p-10 xl:p-14" data-enter>
				<div class="mb-8 lg:hidden">
					<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
				</div>

				{#if data.needsAdminToken}
					<div class="console-panel max-w-md">
						<div class="pane-header">
							<span class="pane-title"><span class="pane-title-bar"></span> Self-host unlock</span>
							<span class="badge badge-primary">admin</span>
						</div>
						<form class="p-5 space-y-4" onsubmit={submit}>
							<p class="text-scifi-muted text-sm m-0 leading-relaxed">
								This console is locked. Enter the
								<code class="text-scifi-cyan">STATSMAN_ADMIN_TOKEN</code> from your environment to continue.
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
								No <code class="text-scifi-cyan">STATSMAN_ADMIN_TOKEN</code> is set — enter once to unlock this
								machine’s console.
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
					<span>Self-hosted Statsman · operator console</span>
				</p>
			</section>
		</div>
	{/if}
</main>
