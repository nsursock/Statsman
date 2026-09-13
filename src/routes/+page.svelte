<script lang="ts">
	import { onMount } from 'svelte';
	import { enterShell, playLandingIntro, typewriter, countUp, gsap } from '@scifiui/core/js';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import Scene3D from '$lib/components/Scene3D.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import MarketingNav from '$lib/components/MarketingNav.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const SNIPPET = '<script defer src="https://YOUR_HOST/tracker.js" data-site="SITE_ID"></scr' + 'ipt>';

	type EventRow = { t: string; path: string; ref: string };

	const seedPaths = [
		'/posts/goodbye-google-analytics',
		'/posts/eleventy-on-fly-io',
		'/posts/sqlite-forever',
		'/about',
		'/posts/ship-log-04',
		'/uses'
	];
	const seedRefs = ['news.ycombinator.com', 'lobste.rs', 'mastodon.social', 'direct', 'til.blog', 'google.com'];

	// Deterministic chart data so SSR and client agree (no hydration mismatch).
	const chart = Array.from({ length: 30 }, (_, i) => {
		const pageviews = Math.round(
			2400 + Math.sin(i / 3.2) * 700 + Math.sin(i / 9.5) * 400 + ((i * 2654435761) % 997) / 997 * 380
		);
		const day = new Date(Date.UTC(2026, 8, 12));
		day.setUTCDate(day.getUTCDate() - (29 - i));
		return {
			date: day.toISOString(),
			pageviews,
			visitors: Math.round(pageviews * 0.55)
		};
	});

	let root: HTMLElement;
	let bootLine = $state('');
	let booted = $state(false);
	let copied = $state(false);
	let stats = $state({ pageviews: 0, visitors: 0, sites: 0 });
	let events = $state<EventRow[]>([
		{ t: '12:01:52', path: '/posts/goodbye-google-analytics', ref: 'news.ycombinator.com' },
		{ t: '12:01:41', path: '/about', ref: 'direct' },
		{ t: '12:01:09', path: '/posts/sqlite-forever', ref: 'lobste.rs' },
		{ t: '12:00:58', path: '/posts/eleventy-on-fly-io', ref: 'mastodon.social' }
	]);

	const fmt = (n: number) => n.toLocaleString('en-US');

	async function copySnippet() {
		try {
			await navigator.clipboard.writeText(SNIPPET);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* clipboard unavailable */
		}
	}

	onMount(() => {
		enterShell(root);
		playLandingIntro(root);

		typewriter('statsman init --mode hybrid --cookieless', (s) => (bootLine = s), () => (booted = true), 24);
		countUp({ pageviews: 128402, visitors: 48913, sites: 3 }, (v) => (stats = v));

		const feed = setInterval(() => {
			const row: EventRow = {
				t: new Date().toLocaleTimeString('en-GB'),
				path: seedPaths[Math.floor(Math.random() * seedPaths.length)],
				ref: seedRefs[Math.floor(Math.random() * seedRefs.length)]
			};
			events = [row, ...events].slice(0, 6);
		}, 2400);

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const ctx = gsap.context(() => {
			if (reduced) return;
			gsap.registerPlugin(ScrollTrigger);
			// batch + onEnter avoids the classic gsap.from+ScrollTrigger trap
			// (immediateRender locks opacity:0, then the tween never plays → cards vanish).
			ScrollTrigger.batch(root.querySelectorAll('[data-reveal]'), {
				start: 'top 90%',
				once: true,
				onEnter: (batch) => {
					gsap.fromTo(
						batch,
						{ autoAlpha: 0, y: 24 },
						{
							autoAlpha: 1,
							y: 0,
							duration: 0.65,
							stagger: 0.07,
							ease: 'power3.out',
							overwrite: 'auto'
						}
					);
				}
			});
		}, root);

		return () => {
			clearInterval(feed);
			ctx.revert();
		};
	});
</script>

<svelte:head>
	<title>Statsman — Privacy-first analytics for indie blogs</title>
	<meta
		name="description"
		content="Cookieless web analytics you can self-host for free, or run on a managed cloud. SQLite or Postgres, Docker-ready, MIT."
	/>
	{#if data.demo && !data.analytics}
		<!-- Dogfood: this landing page is tracked by the demo site. Your visit just fired a real event. -->
		<script defer src="/tracker.js" data-site={data.demo.id} data-allow-localhost></script>
	{/if}
</svelte:head>

<main
	bind:this={root}
	class="relative min-h-screen overflow-x-hidden bg-[var(--scifi-bg)] text-[var(--scifi-text)]"
>
	<Scene3D />

	<div class="relative z-10 mx-auto max-w-6xl px-4 pt-6 sm:px-6">
		<!-- ============ NAV ============ -->
		<MarketingNav demo={Boolean(data.demo)} authed={Boolean(data.authed)} />

		<!-- ============ HERO ============ -->
		<section class="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] mb-20 sm:mb-28">
			<div>
				<p class="label-kicker neon-flicker text-scifi-primary mb-3">// Privacy-first analytics console</p>
				<h1
					class="hero-title hero-title-glitch font-extrabold tracking-tight leading-[0.95] text-5xl sm:text-6xl lg:text-7xl mb-5"
					data-text="OWN THE SIGNAL"
				>
					OWN THE SIGNAL
				</h1>
				<p class="hero-tagline text-scifi-muted text-sm sm:text-base max-w-xl mb-7 leading-relaxed">
					Cookieless pageview analytics for indie blogs. No trackers, no fingerprints, no
					third-party SaaS reading over your shoulder — just your numbers, on your box, in a
					console that feels like a starship.
				</p>
				<div class="flex flex-wrap gap-2 mb-8">
					<span class="feature-pill">Zero cookies</span>
					<span class="feature-pill">~1 KB tracker</span>
					<span class="feature-pill">SQLite / Postgres</span>
					<span class="feature-pill">MIT self-host</span>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					{#if data.demo}
						<a href="/demo" data-sveltekit-reload class="btn-cta">Try the demo</a>
						<a href="/demo/console" class="btn btn-primary">Enter console</a>
						{#if !data.authed}
							<a href="/signup" class="btn btn-ghost">Sign up</a>
						{:else}
							<a href="/dashboard" class="btn btn-ghost">Dashboard</a>
						{/if}
					{:else if data.authed}
						<a href="/dashboard" class="btn-cta">Open dashboard</a>
						<a href="#install" class="btn btn-ghost">Self-host in 60s ↓</a>
					{:else}
						<a href="/signup" class="btn-cta">Sign up — 3k views/mo free</a>
						<a href="/login" class="btn btn-primary">Log in</a>
						<a href="#install" class="btn btn-ghost">Self-host in 60s ↓</a>
					{/if}
				</div>
				<p class="mt-4 text-[0.68rem] tracking-[0.14em] uppercase text-scifi-muted/70">
					No credit card · No cookie banner needed · Cancel anytime
				</p>
			</div>

			<!-- Live console -->
			<div class="console-panel float-y" aria-label="Live analytics preview">
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Live signal</span>
					<span class="status-chip"><span class="dot"></span> ingesting</span>
				</div>
				<div class="p-4 sm:p-5">
					<p class="text-xs text-scifi-cyan mb-4 min-h-4 {booted ? '' : 'caret-blink'}">
						$ {bootLine}{#if booted}&nbsp;<span class="text-scifi-success">✓ tracking {stats.sites} sites</span>{/if}
					</p>
					<div class="grid grid-cols-3 gap-2 mb-4">
						<div class="stat-tile glass rounded-lg">
							<div class="stat-value text-lg sm:text-xl">{fmt(stats.pageviews)}</div>
							<div class="stat-label">Pageviews</div>
						</div>
						<div class="stat-tile glass rounded-lg">
							<div class="stat-value text-lg sm:text-xl">{fmt(stats.visitors)}</div>
							<div class="stat-label">Visitors</div>
						</div>
						<div class="stat-tile glass rounded-lg">
							<div class="stat-value text-lg sm:text-xl">{fmt(stats.sites)}</div>
							<div class="stat-label">Sites</div>
						</div>
					</div>
					<div class="glass rounded-lg p-2 mb-4">
						<Sparkline data={chart} />
					</div>
					<div class="text-[0.68rem] tracking-[0.18em] uppercase text-scifi-muted mb-2">
						Event stream
					</div>
					<ul class="space-y-1.5 text-xs m-0 p-0 list-none">
						{#each events as e (e.t + e.path)}
							<li class="feed-row grid grid-cols-[4.5rem_1fr_auto] gap-2 items-baseline">
								<span class="text-scifi-muted tabular-nums">{e.t}</span>
								<span class="truncate">{e.path}</span>
								<span class="text-scifi-cyan truncate max-w-32">{e.ref}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>

		<!-- ============ LIVE DEMO STRIP ============ -->
		{#if data.demo}
			<section id="demo" class="scroll-mt-28 mb-20 sm:mb-28" data-enter>
				<div class="console-panel relative overflow-hidden">
					<div class="pane-scan"></div>
					<div class="pane-header">
						<span class="pane-title"><span class="pane-title-bar"></span> Live demo — zero setup</span>
						<span class="status-chip"><span class="dot"></span> recording</span>
					</div>
					<div class="p-5 sm:p-6 grid gap-5 lg:grid-cols-[1.2fr_auto] items-center">
						<div>
							<p class="text-sm sm:text-base font-bold mb-2">
								This page is tracking <span class="text-scifi-primary glow-text">itself</span>, right now.
							</p>
							<p class="text-scifi-muted text-sm leading-relaxed m-0">
								Your visit here just fired a real event into this instance. Wander the fake blog —
								every click lands in the console within seconds. No signup, no install, nothing to
								undo.
							</p>
						</div>
						<div class="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
							<a href="/demo" data-sveltekit-reload class="btn btn-primary justify-center">
								Browse the fake blog
							</a>
							<a href="/demo/console" class="btn btn-ghost justify-center">
								Enter console →
							</a>
						</div>
					</div>
				</div>
			</section>
		{/if}
	</div>

	<!-- Ticker divider -->
	<div class="relative z-10 border-y border-[var(--scifi-border)] py-3 mb-20 sm:mb-28 overflow-hidden select-none" aria-hidden="true">
		<div class="ticker-track text-[0.68rem] tracking-[0.3em] uppercase text-scifi-muted/80">
			{#each [0, 1] as half (half)}
				<span class="flex shrink-0 gap-10 pr-10">
					<span>No cookies</span><span class="text-scifi-primary">◆</span>
					<span>No fingerprints</span><span class="text-scifi-cyan">◆</span>
					<span>No third-party SaaS</span><span class="text-scifi-primary">◆</span>
					<span>Your data, your disk</span><span class="text-scifi-cyan">◆</span>
					<span>Docker-ready</span><span class="text-scifi-primary">◆</span>
					<span>Honest free tier</span><span class="text-scifi-cyan">◆</span>
				</span>
			{/each}
		</div>
	</div>

	<div class="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
		<!-- ============ SECTION 01 — WHY ============ -->
		<section id="why" class="scroll-mt-28 mb-20 sm:mb-28">
			<div class="mb-8" data-reveal>
				<p class="label-kicker text-scifi-cyan mb-2">01 / Why Statsman</p>
				<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
					Analytics without the <span class="text-scifi-primary glow-text">surveillance</span>
				</h2>
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="pane pane-bracketed p-5 transition-transform duration-300 hover:-translate-y-1" data-reveal>
					<svg class="w-6 h-6 mb-3 text-scifi-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
						<path d="M9 12l2 2 4-4" />
					</svg>
					<p class="label-kicker mb-2 text-scifi-text">Cookieless by design</p>
					<p class="text-scifi-muted text-sm leading-relaxed">
						A daily rotating visitor hash counts uniques without cookies, device fingerprints, or
						cross-site anything. GDPR-friendly out of the box — no consent banner required.
					</p>
				</div>
				<div class="pane pane-bracketed p-5 transition-transform duration-300 hover:-translate-y-1" data-reveal>
					<svg class="w-6 h-6 mb-3 text-scifi-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<ellipse cx="12" cy="5" rx="8" ry="3" />
						<path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
						<path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
					</svg>
					<p class="label-kicker mb-2 text-scifi-text">Own every byte</p>
					<p class="text-scifi-muted text-sm leading-relaxed">
						Self-host on SQLite in a Docker volume, or point cloud mode at your own Postgres.
						Export it, query it, delete it — it's your data, not a SaaS moat.
					</p>
				</div>
				<div class="pane pane-bracketed p-5 transition-transform duration-300 hover:-translate-y-1" data-reveal>
					<svg class="w-6 h-6 mb-3 text-scifi-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
					</svg>
					<p class="label-kicker mb-2 text-scifi-text">Featherweight tracker</p>
					<p class="text-scifi-muted text-sm leading-relaxed">
						One defer-loaded script, about a kilobyte, zero render-blocking. Over-cap months keep
						your blog green — ingest returns <code class="text-scifi-cyan">204</code>, never errors.
					</p>
				</div>
			</div>
		</section>

		<!-- ============ SECTION 02 — HOW ============ -->
		<section id="how" class="scroll-mt-28 mb-20 sm:mb-28">
			<div class="mb-8" data-reveal>
				<p class="label-kicker text-scifi-cyan mb-2">02 / How it works</p>
				<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
					From zero to signal in <span class="text-scifi-primary glow-text">60 seconds</span>
				</h2>
			</div>

			<div class="grid gap-4 lg:grid-cols-2">
				<div class="pane p-5 sm:p-6" data-reveal>
					<ol class="steps mb-6">
						<li class="step step-primary">Create a site</li>
						<li class="step step-primary">Paste one snippet</li>
						<li class="step step-primary">Watch the signal</li>
					</ol>
					<p class="text-scifi-muted text-sm leading-relaxed mb-4">
						Create a site in the dashboard, paste the one-line snippet into your CMS custom code /
						header-footer setting (WordPress, Ghost, etc.), and pageviews start flowing. No tag
						manager, no build step, no cookie audit.
					</p>
					<ul class="text-sm space-y-2 list-none p-0 m-0">
						<li class="flex gap-2 items-baseline"><span class="text-scifi-primary">▸</span><span class="text-scifi-muted">Domain allowlist on <code class="text-scifi-cyan">/api/event</code> keeps junk out</span></li>
						<li class="flex gap-2 items-baseline"><span class="text-scifi-primary">▸</span><span class="text-scifi-muted">Top pages &amp; referrers, live in the ScifiUI console</span></li>
						<li class="flex gap-2 items-baseline"><span class="text-scifi-primary">▸</span><span class="text-scifi-muted">Optional <code class="text-scifi-cyan">ADMIN_TOKEN</code> locks self-host dashboards</span></li>
					</ul>
				</div>

				<div id="install" class="console-panel scroll-mt-28" data-reveal>
					<div class="pane-header">
						<span class="pane-title"><span class="pane-title-bar"></span> Drop-in tracker</span>
						<button class="btn btn-xs btn-ghost" onclick={copySnippet}>
							{copied ? '✓ copied' : 'copy'}
						</button>
					</div>
					<div class="p-4 sm:p-5">
						<pre class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto mb-3">{SNIPPET}</pre>
						<p class="text-scifi-muted text-xs leading-relaxed">
							Self-hosting? <code class="text-scifi-cyan">docker compose up -d --build</code> and point
							the snippet at <code class="text-scifi-cyan">http://localhost:3000</code>. Data lives in
							the <code class="text-scifi-cyan">statsman-data</code> volume.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- ============ SECTION 03 — TWO PATHS ============ -->
		<section id="plans" class="scroll-mt-28 mb-20 sm:mb-28">
			<div class="mb-8" data-reveal>
				<p class="label-kicker text-scifi-cyan mb-2">03 / Pick your orbit</p>
				<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
					{#if data.billingEnabled}
						Free for small ships. <span class="text-scifi-primary glow-text">Paid for fleets.</span>
					{:else}
						Cloud free while we grow. <span class="text-scifi-primary glow-text">Self-host forever.</span>
					{/if}
				</h2>
			</div>

			<div class="grid gap-4 lg:grid-cols-2 mb-4">
				<div class="metric-card card-bordered" data-reveal>
					<div class="card-head">
						<span class="card-label"><span class="label-bar"></span> Cloud — free beta</span>
						<span class="badge badge-primary">$0</span>
					</div>
					<div class="card-value mb-1">$0<span class="text-sm text-scifi-muted font-normal"> / for now</span></div>
					<p class="text-scifi-muted text-sm leading-relaxed">
						{#if data.billingEnabled}
							Blog, portfolio, side project. Self-host the MIT build with
							<code class="text-scifi-cyan">docker compose up</code> — unlimited everything — or take the
							free cloud tier: 1 site, 3,000 pageviews/mo, no card.
						{:else}
							Magic-link cloud for indie blogs — practical unlimited sites &amp; views while we dogfood.
							No card. Stripe stays off until traction.
						{/if}
					</p>
					<div class="card-actions">
						<a href="/signup" class="btn btn-primary btn-sm">Start free</a>
						<a href="#install" class="btn btn-ghost btn-sm">Self-host instead</a>
					</div>
				</div>
				<div class="metric-card" data-reveal>
					<div class="card-head">
						<span class="card-label"><span class="label-bar"></span> Self-host — forever</span>
						<span class="status-chip"><span class="dot"></span> MIT</span>
					</div>
					<div class="card-value mb-1">$0<span class="text-sm text-scifi-muted font-normal"> / forever</span></div>
					<p class="text-scifi-muted text-sm leading-relaxed">
						{#if data.billingEnabled}
							Multiple blogs, real traffic, zero ops. Magic-link login, managed Postgres, Stripe
							billing, and upgrade banners instead of hard stops. We run the ship; you write the
							blog.
						{:else}
							Run Statsman on your own Docker host — Railway, a VPS, Portainer. Same tracker, your
							disk, no SaaS dependency.
						{/if}
					</p>
					<div class="card-actions">
						{#if data.billingEnabled}
							<a href="/pricing" class="btn btn-sm">Compare plans</a>
						{:else}
							<a href="/self-host" class="btn btn-sm">Self-host guide</a>
						{/if}
					</div>
				</div>
			</div>

			{#if data.billingEnabled}
			<div class="pane" data-reveal>
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Plans at a glance</span>
					<a href="/pricing" class="btn btn-xs btn-ghost">Full pricing →</a>
				</div>
				<div class="p-4 sm:p-5 overflow-x-auto">
					<table class="table-scifi">
						<thead>
							<tr><th>Plan</th><th>Sites</th><th>Pageviews / mo</th><th class="text-right">Price</th></tr>
						</thead>
						<tbody>
							<tr><td>Self-host</td><td>unlimited</td><td>unlimited</td><td class="text-right text-scifi-success">$0</td></tr>
							<tr><td>Free</td><td>1</td><td>3,000</td><td class="text-right">$0</td></tr>
							<tr><td>Indie</td><td>3</td><td>100,000</td><td class="text-right text-scifi-cyan">$9</td></tr>
							<tr><td>Creator</td><td>10</td><td>1,000,000</td><td class="text-right text-scifi-primary">$19</td></tr>
						</tbody>
					</table>
					<p class="text-scifi-muted text-xs mt-3 mb-0 leading-relaxed">
						Over-cap? Ingest quietly returns <code class="text-scifi-cyan">204</code> — your blog
						stays green while the dashboard nudges you to upgrade.
					</p>
				</div>
			</div>
			{:else}
			<div class="pane" data-reveal>
				<div class="pane-header">
					<span class="pane-title"><span class="pane-title-bar"></span> Beta terms</span>
					<a href="/pricing" class="btn btn-xs btn-ghost">Details →</a>
				</div>
				<div class="p-4 sm:p-5 text-sm text-scifi-muted">
					<p class="m-0 leading-relaxed">
						Cloud is free while we grow. If we hit real traction (~1k daily visitors), we’ll turn on
						Stripe — with clear notice before any paid plans go live.
					</p>
				</div>
			</div>
			{/if}
		</section>

		<!-- ============ CTA ============ -->
		<section class="mb-20 sm:mb-24" data-reveal>
			<div class="console-panel relative overflow-hidden p-8 sm:p-14 text-center">
				<div class="grid-floor opacity-40"></div>
				<div class="vignette"></div>
				<div class="scan-line"></div>
				<div class="relative z-10">
					<p class="label-kicker neon-flicker text-scifi-primary mb-3">// Final transmission</p>
					<h2
						class="hero-title hero-title-glitch font-extrabold tracking-tight leading-none text-4xl sm:text-5xl lg:text-6xl mb-4"
						data-text="STOP RENTING YOUR STATS"
					>
						STOP RENTING YOUR STATS
					</h2>
					<p class="text-scifi-muted text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed">
						Spin up the free cloud tier in a minute, or <code class="text-scifi-cyan">docker compose up</code>
						and never think about analytics bills again.
					</p>
					<div class="flex flex-wrap justify-center gap-3">
						{#if data.demo}
							<a href="/demo" data-sveltekit-reload class="btn-cta">Try the demo</a>
						{/if}
						{#if data.authed}
							<a href="/dashboard" class="btn btn-primary">Open dashboard</a>
						{:else}
							<a href="/signup" class="btn btn-primary">Sign up</a>
							<a href="/login" class="btn btn-ghost">Log in</a>
						{/if}
					</div>
					<p class="mt-5 text-[0.68rem] tracking-[0.14em] uppercase text-scifi-muted/70">
						{#if data.billingEnabled}
							3,000 pageviews/mo free · No credit card · MIT self-host
						{:else}
							Free cloud beta · No credit card · MIT self-host
						{/if}
					</p>
				</div>
			</div>
		</section>
	</div>

	<!-- ============ FOOTER ============ -->
	<footer class="footer relative z-10">
		<div class="mx-auto w-full max-w-6xl grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr] px-2 sm:px-4">
			<div>
				<a href="/" class="brand-mark text-lg no-underline">Statsman</a>
				<p class="text-scifi-muted text-xs leading-relaxed mt-3 mb-4 max-w-xs">
					Privacy-first web analytics for indie blogs. Cookieless pageviews, a ScifiUI console,
					and data that stays yours.
				</p>
				<span class="status-chip"><span class="dot"></span> all systems nominal</span>
			</div>
			<div>
				<p class="footer-title">Product</p>
				<ul class="space-y-2 list-none p-0 m-0 text-xs">
					{#if data.demo}
						<li><a href="/demo" data-sveltekit-reload>Live demo</a></li>
					{/if}
					<li><a href="/pricing">Pricing</a></li>
					{#if data.authed}
						<li><a href="/dashboard">Dashboard</a></li>
					{:else}
						<li><a href="/signup">Sign up</a></li>
						<li><a href="/login">Log in</a></li>
					{/if}
					<li><a href="#install">Drop-in tracker</a></li>
				</ul>
			</div>
			<div>
				<p class="footer-title">Self-host</p>
				<ul class="space-y-2 list-none p-0 m-0 text-xs">
					<li><a href="/self-host">Setup guide</a></li>
					<li><code class="text-scifi-cyan">docker compose up</code></li>
					<li><span class="text-scifi-muted">Any Docker host · SQLite or Postgres</span></li>
					<li><span class="text-scifi-muted">MIT license</span></li>
				</ul>
			</div>
		</div>
		<div class="mx-auto w-full max-w-6xl px-2 sm:px-4 pt-5 mt-2 border-t border-[var(--scifi-border)] flex flex-wrap items-center justify-between gap-3 text-[0.68rem] tracking-[0.12em] uppercase">
			<span>© 2026 Statsman — MIT</span>
			<span class="text-scifi-muted/70">Built with SvelteKit · ScifiUI · Three.js</span>
		</div>
	</footer>
</main>

<style>
	@keyframes feed-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.feed-row:first-child {
		animation: feed-in 0.45s var(--scifi-ease, ease-out);
	}
	.ticker-track {
		display: flex;
		width: max-content;
		animation: ticker 30s linear infinite;
	}
	@keyframes ticker {
		to {
			transform: translateX(-50%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticker-track,
		.feed-row:first-child {
			animation: none;
		}
	}
</style>
