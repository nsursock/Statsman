<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';

	const ENV_VARS = `STATSMAN_MODE=selfhost
PUBLIC_ORIGIN=https://YOUR_APP.up.railway.app
DATABASE_URL=postgres://...   # from Supabase
ADMIN_TOKEN=                  # openssl rand -hex 32
SESSION_SECRET=               # openssl rand -hex 32`;

	const SNIPPET =
		'<script defer src="https://YOUR_APP.up.railway.app/tracker.js" data-site="SITE_ID"></scr' + 'ipt>';

	const ENV_HOOK = `PUBLIC_ANALYTICS_ORIGIN=https://YOUR_APP.up.railway.app
PUBLIC_ANALYTICS_SITE_ID=SITE_ID`;

	let copied = $state<'env' | 'snippet' | 'hook' | null>(null);

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
		content="Step-by-step: self-host Statsman on Railway with Supabase Postgres, then track any website."
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
			<p class="label-kicker text-scifi-primary">Self-host guide</p>
			<h1 class="hero-title text-4xl font-extrabold">Run your own Statsman</h1>
			<p class="text-scifi-muted text-sm max-w-xl leading-relaxed">
				Deploy Statsman on a host you control, store data in Postgres, paste one script on any
				website. Free forever (MIT). Follow every step below — when you’re done, real pageviews show
				up in your dashboard.
			</p>
		</section>

		<section class="pane pane-bracketed p-5 space-y-3 text-sm text-scifi-muted">
			<p class="label-kicker text-scifi-primary m-0">What this guide uses</p>
			<ul class="m-0 pl-4 space-y-2 leading-relaxed">
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">App host: Railway</strong> — runs the
					existing Dockerfile (Node). Free trial / hobby usage is enough to start.
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Database: Supabase</strong> — Postgres.
					Statsman switches to Postgres automatically when
					<code class="text-scifi-cyan">DATABASE_URL</code> is set.
				</li>
			</ul>
			<p class="m-0 text-xs leading-relaxed">
				Why not Vercel for the app? This repo ships
				<code class="text-scifi-cyan">adapter-node</code> + a long-running server. Vercel wants the
				Vercel adapter. Supabase still fits perfectly as the DB. Alternatives that also work: Fly.io,
				Render, or any VPS with Docker — same env vars.
			</p>
		</section>

		<!-- Step 1 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 1 · Create a Supabase database</span>
				<span class="badge badge-primary">db</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<ol class="m-0 pl-4 space-y-2 leading-relaxed">
					<li>
						Go to
						<a class="text-scifi-cyan" href="https://supabase.com/dashboard" rel="noopener"
							>supabase.com/dashboard</a
						>
						and create a project (any region).
					</li>
					<li>
						Wait until the project is healthy. Open
						<strong class="text-[var(--scifi-text)] font-medium"
							>Project Settings → Database</strong
						>.
					</li>
					<li>
						Under <strong class="text-[var(--scifi-text)] font-medium">Connection string</strong>,
						choose <strong class="text-[var(--scifi-text)] font-medium">URI</strong>. Prefer
						<strong class="text-[var(--scifi-text)] font-medium">Session pooler</strong> (or Direct
						if you stay in the same region as the app).
					</li>
					<li>
						Copy the URI and replace <code class="text-scifi-cyan">[YOUR-PASSWORD]</code> with the
						database password you set at project creation.
					</li>
				</ol>
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Done when:</strong> you have a string
					starting with <code class="text-scifi-cyan">postgres://</code> or
					<code class="text-scifi-cyan">postgresql://</code>. You do
					<strong class="text-[var(--scifi-text)] font-medium">not</strong> create tables by hand —
					Statsman migrates on boot.
				</p>
			</div>
		</section>

		<!-- Step 2 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 2 · Deploy the app on Railway</span>
				<span class="badge badge-primary">app</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<ol class="m-0 pl-4 space-y-2 leading-relaxed">
					<li>
						Push this repo to GitHub (or fork
						<a class="text-scifi-cyan" href="https://github.com/nsursock/Statsman" rel="noopener"
							>nsursock/Statsman</a
						>).
					</li>
					<li>
						Open
						<a class="text-scifi-cyan" href="https://railway.app/new" rel="noopener"
							>railway.app/new</a
						>
						→ <strong class="text-[var(--scifi-text)] font-medium">Deploy from GitHub repo</strong>
						→ select the Statsman repo.
					</li>
					<li>
						Railway should detect the <code class="text-scifi-cyan">Dockerfile</code>. Deploy once
						(it may fail until env vars are set — that’s OK).
					</li>
					<li>
						Open the service → <strong class="text-[var(--scifi-text)] font-medium">Settings → Networking</strong>
						→ <strong class="text-[var(--scifi-text)] font-medium">Generate domain</strong>. Copy the
						public URL (e.g. <code class="text-scifi-cyan">https://….up.railway.app</code>).
					</li>
					<li>
						Open <strong class="text-[var(--scifi-text)] font-medium">Variables</strong> and add:
					</li>
				</ol>
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
						<code class="text-scifi-cyan">PUBLIC_ORIGIN</code> = the Railway HTTPS URL (no trailing
						slash)
					</li>
					<li>
						<code class="text-scifi-cyan">DATABASE_URL</code> = the Supabase URI from Step 1
					</li>
					<li>
						Generate tokens locally:
						<code class="text-scifi-cyan">openssl rand -hex 32</code> (run twice)
					</li>
				</ul>
				<p class="m-0 text-xs leading-relaxed">
					Redeploy after saving variables (Railway usually does this automatically).
				</p>
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Done when:</strong>
					<code class="text-scifi-cyan">https://YOUR_APP.up.railway.app/login</code> loads.
				</p>
			</div>
		</section>

		<!-- Step 3 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 3 · Create a site in Statsman</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<ol class="m-0 pl-4 space-y-2 leading-relaxed">
					<li>
						Open <code class="text-scifi-cyan">https://YOUR_APP.up.railway.app/login</code>.
					</li>
					<li>
						Enter the console (or unlock with the
						<code class="text-scifi-cyan">ADMIN_TOKEN</code> you set).
					</li>
					<li>
						Create a site:
						<ul class="mt-1 space-y-1">
							<li>
								<strong class="text-[var(--scifi-text)] font-medium">Name</strong> — anything
								(e.g. <code class="text-scifi-cyan">My blog</code>)
							</li>
							<li>
								<strong class="text-[var(--scifi-text)] font-medium">Domain</strong> — the host of
								the website you’ll track, with no protocol. Examples:
								<code class="text-scifi-cyan">blog.example.com</code>,
								<code class="text-scifi-cyan">statsman.fly.dev</code>
							</li>
						</ul>
					</li>
					<li>
						Open <strong class="text-[var(--scifi-text)] font-medium">Settings → Tracker</strong>.
						Copy the snippet (or at least the <code class="text-scifi-cyan">SITE_ID</code>).
					</li>
				</ol>
				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Done when:</strong> you have a
					<code class="text-scifi-cyan">SITE_ID</code>.
				</p>
			</div>
		</section>

		<!-- Step 4 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 4 · Add the tracker to your website</span>
				<span class="status-chip"><span class="dot"></span> ~1 KB</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<p class="m-0 leading-relaxed">
					Paste this into your site’s
					<strong class="text-[var(--scifi-text)] font-medium">custom code / header-footer</strong>
					setting (WordPress theme options, “Insert Headers and Footers”, Ghost code injection,
					etc.). Head or footer — both work.
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
				<p class="m-0 text-xs leading-relaxed">
					Replace <code class="text-scifi-cyan">YOUR_APP.up.railway.app</code> and
					<code class="text-scifi-cyan">SITE_ID</code> with yours. The domain you registered in Step
					3 must match the live site host.
				</p>

				<p class="label-kicker text-scifi-primary m-0">Tracking this Statsman marketing site?</p>
				<p class="m-0 leading-relaxed">
					Set these on the <em>marketing</em> deploy, then redeploy:
				</p>
				<div class="relative">
					<pre
						class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto m-0 whitespace-pre-wrap"
					>{ENV_HOOK}</pre>
					<button
						type="button"
						class="btn btn-xs btn-ghost absolute top-2 right-2"
						onclick={() => copy('hook', ENV_HOOK)}
					>
						{copied === 'hook' ? 'Copied' : 'Copy'}
					</button>
				</div>

				<p class="m-0 leading-relaxed">
					<strong class="text-[var(--scifi-text)] font-medium">Done when:</strong> view-source (or
					DevTools) on the tracked site shows <code class="text-scifi-cyan">tracker.js</code>.
				</p>
			</div>
		</section>

		<!-- Step 5 -->
		<section class="console-panel">
			<div class="pane-header">
				<span class="pane-title"><span class="pane-title-bar"></span> Step 5 · Verify it works</span>
			</div>
			<div class="p-4 space-y-3 text-sm text-scifi-muted">
				<ol class="m-0 pl-4 space-y-2 leading-relaxed">
					<li>Open the tracked website in a private window and hard-refresh.</li>
					<li>
						DevTools → Network: <code class="text-scifi-cyan">tracker.js</code> is 200, and
						<code class="text-scifi-cyan">/api/event</code> is 200 or 204.
					</li>
					<li>
						Open <code class="text-scifi-cyan">https://YOUR_APP.up.railway.app/dashboard</code>,
						select your site — a pageview should appear within a few seconds.
					</li>
				</ol>
				<p class="m-0 text-xs leading-relaxed">
					No events? Check domain spelling (no <code class="text-scifi-cyan">https://</code>), that
					<code class="text-scifi-cyan">PUBLIC_ORIGIN</code> matches the Railway URL, and that
					Supabase allows connections (password / pooler host correct).
				</p>
			</div>
		</section>

		<section class="pane pane-bracketed p-5 space-y-2 text-sm text-scifi-muted">
			<p class="label-kicker text-scifi-primary m-0">Other stacks</p>
			<ul class="m-0 pl-4 space-y-2 leading-relaxed">
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Fly.io + SQLite:</strong> use
					<code class="text-scifi-cyan">fly.toml</code> + a volume at
					<code class="text-scifi-cyan">/data</code> — no Supabase needed.
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Fly / Render + Supabase:</strong> same
					env vars as Step 2; point the platform at the Dockerfile.
				</li>
				<li>
					<strong class="text-[var(--scifi-text)] font-medium">Docker on a VPS:</strong>
					<code class="text-scifi-cyan">docker compose up -d --build</code> with
					<code class="text-scifi-cyan">DATABASE_URL</code> (Postgres) or a local SQLite volume, plus
					a reverse proxy for HTTPS.
				</li>
			</ul>
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
