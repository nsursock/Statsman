<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const EMAIL = $derived(data.contactEmail);
	const SUBJECT = 'Statsman — let’s talk';
	const MAILTO = $derived(`mailto:${EMAIL}?subject=${encodeURIComponent(SUBJECT)}`);

	let name = $state('');
	let email = $state('');
	let message = $state('');
	let busy = $state(false);
	let errorMsg = $state('');
	let sent = $state(false);
	let copied = $state(false);

	async function copyEmail() {
		try {
			await navigator.clipboard.writeText(EMAIL);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* clipboard unavailable */
		}
	}

	async function submit(e: Event) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, message })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not send message');
			sent = true;
			name = '';
			email = '';
			message = '';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Contact · Statsman</title>
	<meta
		name="description"
		content="Get in touch with the Statsman team — email hello@statsman.xyz for support, feedback, or self-host questions."
	/>
</svelte:head>

<main class="min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)]">
	<header class="app-bar">
		<a href="/" class="brand-mark text-base no-underline text-[var(--scifi-text)]">Statsman</a>
		<div class="flex gap-2 items-center">
			<ThemePicker compact />
			<a class="btn btn-sm btn-ghost" href="/pricing">Pricing</a>
			<a class="btn btn-sm btn-primary" href="/dashboard">Dashboard</a>
		</div>
	</header>

	<div class="mx-auto max-w-5xl px-4 py-10">
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- ============ SIDEBAR (1/3) ============ -->
			<aside class="lg:col-span-1 space-y-6">
				<section class="space-y-3">
					<p class="label-kicker text-scifi-primary">Contact</p>
					<h1 class="hero-title text-3xl font-extrabold leading-tight">Talk to a human</h1>
					<p class="text-scifi-muted text-sm leading-relaxed m-0">
						Questions about the cloud, self-hosting, billing, or the tracker? Send a message — we
						read everything and reply fast. No tickets, no bots.
					</p>
				</section>

				<section class="console-panel">
					<div class="pane-header">
						<span class="pane-title"><span class="pane-title-bar"></span> Direct email</span>
					</div>
					<div class="p-4 space-y-3 text-sm text-scifi-muted">
						<p class="m-0 leading-relaxed">
							Prefer your own mail client? Reach us directly.
						</p>
						<div class="relative">
							<pre class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto m-0">{EMAIL}</pre>
							<button
								type="button"
								class="btn btn-xs btn-ghost absolute top-2 right-2"
								onclick={copyEmail}
							>
								{copied ? 'Copied' : 'Copy'}
							</button>
						</div>
						<a class="btn btn-primary w-full text-center" href={MAILTO}>
							<i class="ti ti-mail" aria-hidden="true"></i>
							Compose an email →
						</a>
					</div>
				</section>
			</aside>

			<!-- ============ MAIN (2/3) ============ -->
			<div class="lg:col-span-2 space-y-6">
				{#if sent}
					<section class="console-panel">
						<div class="pane-header">
							<span class="pane-title"><span class="pane-title-bar"></span> Message sent</span>
							<span class="status-chip"><span class="dot"></span> delivered</span>
						</div>
						<div class="p-5 space-y-4">
							<p class="text-sm leading-relaxed m-0">
								Thanks — we got your message and will reply to your inbox shortly.
							</p>
							<button
								type="button"
								class="btn btn-ghost w-full"
								onclick={() => {
									sent = false;
								}}
							>
								Send another
							</button>
						</div>
					</section>
				{:else}
					<section class="console-panel">
						<div class="pane-header">
							<span class="pane-title"><span class="pane-title-bar"></span> Send a message</span>
							<span class="badge badge-primary">fast replies</span>
						</div>
						<form class="p-5 space-y-4" onsubmit={submit}>
							<div class="grid gap-4 sm:grid-cols-2">
								<label class="block space-y-1.5">
									<span class="label-kicker">Name</span>
									<input
										class="input w-full"
										type="text"
										bind:value={name}
										required
										maxlength="120"
										autocomplete="name"
										placeholder="Ada Lovelace"
									/>
								</label>
								<label class="block space-y-1.5">
									<span class="label-kicker">Email</span>
									<input
										class="input w-full"
										type="email"
										bind:value={email}
										required
										maxlength="160"
										autocomplete="email"
										placeholder="you@indie.dev"
									/>
								</label>
							</div>
							<label class="block space-y-1.5">
								<span class="label-kicker">Message</span>
								<textarea
									class="input w-full min-h-48 resize-y"
									bind:value={message}
									required
									maxlength="4000"
									placeholder="What’s on your mind?"
								></textarea>
							</label>
							{#if errorMsg}
								<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
							{/if}
							<button class="btn-cta w-full" type="submit" disabled={busy}>
								{busy ? 'Sending…' : 'Send message'}
							</button>
						</form>
					</section>
				{/if}
			</div>
		</div>

		<section class="pane pane-bracketed p-5 space-y-3 text-sm text-scifi-muted mt-6">
			<p class="label-kicker text-scifi-primary m-0">What to include</p>
			<ul class="m-0 grid gap-3 sm:grid-cols-2 pl-4">
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Support</strong> — your site URL,
					what you expected, and what you saw (a screenshot helps).
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Self-host</strong> — your host
					(Railway, VPS, …), storage (SQLite / Postgres), and the relevant env vars (redact
					secrets).
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Billing</strong> — the email on your
					account and the plan you’re on.
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Feedback</strong> — anything you’d
					like to see next. We build in the open.
				</li>
			</ul>
		</section>

		<p class="text-xs text-scifi-muted pt-6 pb-8">
			<a href="/" class="text-scifi-cyan no-underline hover:text-scifi-primary">← Home</a>
			<span class="mx-2 opacity-40">·</span>
			<a href="/pricing" class="no-underline hover:text-scifi-primary">Pricing</a>
			<span class="mx-2 opacity-40">·</span>
			<a href="/self-host" class="no-underline hover:text-scifi-primary">Self-host</a>
		</p>
	</div>
</main>
