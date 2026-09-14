<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';

	const COMPOSE = `docker compose up -d --build`;

	const ENV_VARS = `STATSMAN_MODE=selfhost
PUBLIC_ORIGIN=https://YOUR_PUBLIC_HTTPS_URL
STATSMAN_ADMIN_TOKEN=
STATSMAN_SESSION_SECRET=
# Pick one storage:
# STATSMAN_DATABASE_PATH=/data/statsman.db  # SQLite on a Docker/Railway volume
# DATABASE_URL=postgres://...              # Supabase / any Postgres (wins over PATH)`;

	const SNIPPET =
		'<script defer src="https://YOUR_PUBLIC_HTTPS_URL/tracker.js" data-site="SITE_ID"></scr' + 'ipt>';

	let copied = $state<'compose' | 'env' | 'snippet' | null>(null);

	async function copy(kind: NonNullable<typeof copied>, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = kind;
			setTimeout(() => (copied = null), 1600);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<svelte:head>
	<title>Self-host · Statsman</title>
	<meta
		name="description"
		content="Run Statsman anywhere Docker runs. Step-by-step self-host guide — SQLite volume or Postgres."
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

	<div class="mx-auto max-w-3xl px-4 py-10 space-y-8">
		<section class="space-y-3">
			<p class="label-kicker text-scifi-primary">Self-host · MIT</p>
			<h1 class="hero-title text-4xl font-extrabold">Run Statsman anywhere Docker runs</h1>
			<p class="text-scifi-muted text-sm max-w-xl leading-relaxed">
				One container. Your disk or your Postgres. Pick Railway, Render, a VPS, or anything else that
				speaks Docker — then paste one script on the sites you track.
			</p>
		</section>

		<section class="pane pane-bracketed p-5 space-y-3 text-sm text-scifi-muted">
			<p class="label-kicker text-scifi-primary m-0">Product vs your install</p>
			<ul class="m-0 pl-4 space-y-2 leading-relaxed">
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Main site</strong> (we run it on
					Railway + Supabase) — marketing, pricing, and the managed cloud.
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Self-host</strong> (you) —
					<code class="text-scifi-cyan">STATSMAN_MODE=selfhost</code>: login → dashboard → add sites.
					No landing page, no signup wall.
				</li>
			</ul>
		</section>

		<!-- Step 1 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 1 · Pick a Docker host</span>
				<span class="badge badge-primary">you choose</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<p class="m-0 leading-relaxed">
					Deploy this repo’s <code class="text-scifi-cyan">Dockerfile</code> (or Compose file) on any
					platform that runs containers with a public HTTPS URL:
				</p>
				<ul class="m-0 pl-4 space-y-1.5 leading-relaxed">
					<li>Railway, Render, Fly, Google Cloud Run, …</li>
					<li>A VPS with Docker + Caddy/nginx</li>
					<li>Home lab / Portainer / Coolify</li>
				</ul>
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Local try:</strong>
				</p>
				<div class="relative">
					<pre class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto m-0">{COMPOSE}</pre>
					<button
						type="button"
						class="btn btn-xs btn-ghost absolute top-2 right-2"
						onclick={() => copy('compose', COMPOSE)}
					>
						{copied === 'compose' ? 'Copied' : 'Copy'}
					</button>
				</div>
				<p class="m-0 text-xs leading-relaxed">
					Laptop Compose is only for poking at the UI. Real traffic needs a host that stays online.
				</p>
			</div>
		</section>

		<!-- Step 2 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 2 · Storage + env</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">SQLite:</strong> mount a persistent
					volume at <code class="text-scifi-cyan">/data</code> (Railway Volume, Docker volume, disk
					path).
				</p>
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Postgres:</strong> create a database
					(Supabase, Neon, RDS, …) and set <code class="text-scifi-cyan">DATABASE_URL</code>. When
					that URI is <code class="text-scifi-cyan">postgres://…</code>, Statsman uses Postgres and
					ignores <code class="text-scifi-cyan">STATSMAN_DATABASE_PATH</code>.
				</p>
				<div class="relative">
					<pre
						class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto m-0 whitespace-pre-wrap"
					>{ENV_VARS}</pre>
					<button
						type="button"
						class="btn btn-xs btn-ghost absolute top-2 right-2"
						onclick={() => copy('env', ENV_VARS)}
					>
						{copied === 'env' ? 'Copied' : 'Copy'}
					</button>
				</div>
				<ul class="m-0 pl-4 space-y-1.5 leading-relaxed">
					<li>
						<code class="text-scifi-cyan">PUBLIC_ORIGIN</code> = this install’s public HTTPS URL (no
						trailing slash)
					</li>
					<li>
						Tokens: <code class="text-scifi-cyan">openssl rand -hex 32</code> (twice)
					</li>
					<li>
						Behind a reverse proxy, set the visitor IP header if needed (e.g.
						<code class="text-scifi-cyan">ADDRESS_HEADER=x-forwarded-for</code>)
					</li>
				</ul>
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Done when:</strong>
					<code class="text-scifi-cyan">https://YOUR_URL/</code> shows the login / operator screen.
				</p>
			</div>
		</section>

		<!-- Step 3 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 3 · Create a site</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<ol class="m-0 pl-4 space-y-2 leading-relaxed">
					<li>Open your Statsman URL — self-host starts at login.</li>
					<li>
						Enter the console (or unlock with
						<code class="text-scifi-cyan">STATSMAN_ADMIN_TOKEN</code>).
					</li>
					<li>
						Add a site: name + domain of the website you’ll track (host only, e.g.
						<code class="text-scifi-cyan">blog.example.com</code>).
					</li>
					<li>Settings → Tracker → copy the snippet / site id.</li>
				</ol>
			</div>
		</section>

		<!-- Step 4 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 4 · Inject the tracker</span>
				<span class="status-chip"><span class="dot"></span> ~1 KB</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<p class="m-0 leading-relaxed">
					Paste into the site’s
					<strong class="text-[var(--scifi-text)] font-medium">custom code / header-footer</strong>
					setting (WordPress, Ghost, etc.). Head or footer both work.
				</p>
				<div class="relative">
					<pre class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto m-0">{SNIPPET}</pre>
					<button
						type="button"
						class="btn btn-xs btn-ghost absolute top-2 right-2"
						onclick={() => copy('snippet', SNIPPET)}
					>
						{copied === 'snippet' ? 'Copied' : 'Copy'}
					</button>
				</div>
			</div>
		</section>

		<!-- Step 5 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 5 · Verify</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<ol class="m-0 pl-4 space-y-2 leading-relaxed">
					<li>Private window → hard-refresh the tracked site.</li>
					<li>
						Network: <code class="text-scifi-cyan">tracker.js</code> 200,
						<code class="text-scifi-cyan">/api/event</code> 200/204.
					</li>
					<li>Dashboard → your site → pageview appears.</li>
				</ol>
			</div>
		</section>

		<section class="pane pane-bracketed p-5 space-y-2 text-sm text-scifi-muted">
			<p class="label-kicker text-scifi-primary m-0">Example stacks</p>
			<ul class="m-0 pl-4 space-y-2 leading-relaxed">
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Railway + Supabase</strong> — Dockerfile
					deploy + <code class="text-scifi-cyan">DATABASE_URL</code> (what we use for the main site’s
					DB too).
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Railway + volume</strong> — SQLite at
					<code class="text-scifi-cyan">/data</code>, no external DB.
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">VPS</strong> —
					<code class="text-scifi-cyan">docker compose</code> + Caddy for HTTPS.
				</li>
			</ul>
			<p class="m-0 text-xs leading-relaxed">
				Skip serverless Node (typical Vercel) unless you change adapters — this image is a long-running
				server.
			</p>
		</section>

		<p class="text-xs text-scifi-muted pb-8">
			<a href="/" class="text-scifi-cyan no-underline hover:text-scifi-primary">← Home</a>
			<span class="mx-2 opacity-40">·</span>
			<a href="/pricing" class="no-underline hover:text-scifi-primary">Pricing</a>
			<span class="mx-2 opacity-40">·</span>
			<span>MIT license</span>
		</p>
	</div>
</main>
