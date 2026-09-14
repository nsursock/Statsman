<script lang="ts">
	import type { Site, TrackingPatch } from './types';
	import { readOptOut, writeOptOut, parseIps } from './optout';

	let {
		site,
		origin,
		clientIp = null,
		copied = false,
		onCopyTracker,
		onSaveTracking,
		onGoToSites
	}: {
		site: Site | null;
		origin: string;
		clientIp?: string | null;
		copied?: boolean;
		onCopyTracker: () => void | Promise<void>;
		onSaveTracking?: (patch: TrackingPatch) => void | Promise<void>;
		onGoToSites: () => void;
	} = $props();

	let browserExcluded = $state(false);
	let ignoreLocalhost = $state(true);
	let excludedIps = $state<string[]>([]);
	let ipDraft = $state('');
	let trackingSaving = $state(false);
	let trackingMsg = $state('');

	const allowLocalhostAttr = $derived(
		site && site.ignore_localhost === false ? ' data-allow-localhost' : ''
	);
	const snippet = $derived(
		site
			? `<script defer src="${origin}/tracker.js" data-site="${site.id}"${allowLocalhostAttr}></scr` +
				'ipt>'
			: ''
	);
	const previewUrl = $derived(
		!site
			? ''
			: (() => {
					const d = site.domain.trim().toLowerCase();
					if (d === 'localhost' || d === '127.0.0.1' || d.endsWith('.local')) {
						return `${origin}/demo?statsman_debug=1`;
					}
					return `https://${site.domain}/?statsman_debug=1`;
				})()
	);

	$effect(() => {
		// re-sync when the active site changes
		browserExcluded = readOptOut();
		ignoreLocalhost = site?.ignore_localhost !== false;
		excludedIps = parseIps(site);
		ipDraft = '';
		trackingMsg = '';
	});

	function toggleBrowserExclusion() {
		const next = !browserExcluded;
		writeOptOut(next);
		browserExcluded = next;
	}

	async function persistTracking(patch: TrackingPatch) {
		if (!onSaveTracking || !site) return;
		trackingSaving = true;
		trackingMsg = '';
		try {
			await onSaveTracking(patch);
			trackingMsg = 'Saved.';
		} catch (err) {
			trackingMsg = err instanceof Error ? err.message : 'Save failed.';
			throw err;
		} finally {
			trackingSaving = false;
		}
	}

	async function toggleIgnoreLocalhost() {
		const next = !ignoreLocalhost;
		ignoreLocalhost = next;
		try {
			await persistTracking({ ignore_localhost: next });
		} catch {
			ignoreLocalhost = !next;
		}
	}

	async function addExcludedIp() {
		const ip = ipDraft.trim();
		if (!ip) return;
		if (excludedIps.includes(ip)) {
			ipDraft = '';
			return;
		}
		const prev = excludedIps;
		const next = [...excludedIps, ip];
		excludedIps = next;
		ipDraft = '';
		try {
			await persistTracking({ excluded_ips: next });
		} catch {
			excludedIps = prev;
		}
	}

	async function addMyIp() {
		if (!clientIp) return;
		ipDraft = clientIp;
		await addExcludedIp();
	}

	async function removeExcludedIp(ip: string) {
		const prev = excludedIps;
		const next = excludedIps.filter((x) => x !== ip);
		excludedIps = next;
		try {
			await persistTracking({ excluded_ips: next });
		} catch {
			excludedIps = prev;
		}
	}
</script>

{#if site}
	<p class="text-sm text-scifi-muted m-0 mb-3 leading-relaxed">
		Paste this into
		<strong class="text-[var(--scifi-text)]">{site.name}</strong>’s custom
		code / header-footer setting (WordPress theme options, injection plugins,
		etc.) — head or footer. ~1&nbsp;KB, zero cookies by default. Domain:
		<code class="text-scifi-cyan">{site.domain}</code>
	</p>
	<div class="snippet-block">
		<div class="snippet-toolbar">
			<span class="status-chip"><span class="dot"></span> tracker.js</span>
			<button type="button" class="btn btn-xs btn-primary" onclick={onCopyTracker}>
				{copied ? 'Copied' : 'Copy snippet'}
			</button>
		</div>
		<pre class="snippet-code">{snippet}</pre>
	</div>
	<p class="text-sm text-scifi-muted m-0 mt-4 mb-2 leading-relaxed">
		<strong class="text-[var(--scifi-text)] font-medium">Automatic</strong> (one
		snippet): pageview, engagement, engaged_visit, route_change, outbound_link,
		download, scroll_25/50/75/90. Meaningful behavior only — not every mouse move.
	</p>
	<p class="text-sm text-scifi-muted m-0 mb-2 leading-relaxed">
		<strong class="text-[var(--scifi-text)] font-medium">Custom</strong> — your
		business events (no passwords/emails in props):
	</p>
	<pre class="snippet-code text-[0.7rem]">{`statsman.track('signup')
statsman.track('newsletter_subscribe')
statsman.track('purchase', { plan: 'indie' })`}</pre>

	<div class="exclusion-block">
		<p class="label-kicker mb-2">Traffic exclusions</p>
		<p class="text-sm text-scifi-muted m-0 mb-3 leading-relaxed">
			Statsman tracks visitors unless the browser explicitly opts out. Keep your
			own development traffic out of production numbers.
		</p>

		<div class="exclusion-row">
			<div class="min-w-0">
				<p class="m-0 text-sm font-semibold">Exclude this browser</p>
				<p class="m-0 mt-1 text-[0.7rem] text-scifi-muted leading-relaxed">
					{#if browserExcluded}
						This browser is opted out on the Statsman origin.
					{:else}
						Sets a persistent <code class="text-scifi-cyan">statsman_optout</code> flag
						here. For your live site, use Preview site below.
					{/if}
				</p>
			</div>
			<button
				type="button"
				class="btn btn-sm {browserExcluded ? 'btn-ghost' : 'btn-primary'} shrink-0"
				onclick={toggleBrowserExclusion}
			>
				{browserExcluded ? 'Enable tracking' : 'Exclude my visits'}
			</button>
		</div>

		{#if previewUrl}
			<div class="exclusion-row">
				<div class="min-w-0">
					<p class="m-0 text-sm font-semibold">Preview site</p>
					<p class="m-0 mt-1 text-[0.7rem] text-scifi-muted leading-relaxed">
						Opens your site with <code class="text-scifi-cyan">?statsman_debug=1</code> —
						the tracker opts this browser out on that domain permanently.
					</p>
				</div>
				<a
					class="btn btn-sm btn-ghost shrink-0"
					href={previewUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					Open preview
				</a>
			</div>
		{/if}

		<label class="exclusion-check">
			<input
				type="checkbox"
				checked={ignoreLocalhost}
				disabled={trackingSaving || !onSaveTracking}
				onchange={toggleIgnoreLocalhost}
			/>
			<span>
				<span class="block text-sm font-semibold">Ignore localhost / development traffic</span>
				<span class="block text-[0.7rem] text-scifi-muted mt-0.5 leading-relaxed">
					Skips <code class="text-scifi-cyan">localhost</code>,
					<code class="text-scifi-cyan">127.0.0.1</code>, and
					<code class="text-scifi-cyan">*.local</code>. Uncheck only if you
					intentionally track a local blog — then re-copy the snippet (it adds
					<code class="text-scifi-cyan">data-allow-localhost</code>).
				</span>
			</span>
		</label>

		<div class="mt-4">
			<p class="m-0 text-sm font-semibold mb-1">Excluded IP addresses</p>
			<p class="m-0 mb-2 text-[0.7rem] text-scifi-muted leading-relaxed">
				Optional. Soft-drops matching requests at ingest. IPs are never stored on
				events — only on this exclusion list. Prefer browser opt-out when you can.
			</p>
			{#if excludedIps.length}
				<ul class="ip-list">
					{#each excludedIps as ip (ip)}
						<li>
							<code>{ip}</code>
							<button
								type="button"
								class="ip-remove"
								disabled={trackingSaving}
								onclick={() => removeExcludedIp(ip)}
							>
								Remove
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<form
				class="ip-add"
				onsubmit={(e) => {
					e.preventDefault();
					void addExcludedIp();
				}}
			>
				<input
					class="input"
					bind:value={ipDraft}
					placeholder="203.0.113.10"
					autocomplete="off"
					disabled={trackingSaving || !onSaveTracking}
				/>
				<button
					type="submit"
					class="btn btn-sm btn-primary"
					disabled={trackingSaving || !ipDraft.trim() || !onSaveTracking}
				>
					Add IP
				</button>
				{#if clientIp}
					<button
						type="button"
						class="btn btn-sm btn-ghost"
						disabled={trackingSaving || !onSaveTracking}
						onclick={() => void addMyIp()}
					>
						Add my IP
					</button>
				{/if}
			</form>
			{#if clientIp}
				<p class="m-0 mt-2 text-[0.65rem] text-scifi-muted font-mono">
					Detected · {clientIp}
				</p>
			{/if}
			{#if trackingMsg}
				<p class="m-0 mt-2 text-xs text-scifi-cyan">{trackingMsg}</p>
			{/if}
		</div>
	</div>

	<p class="text-[0.65rem] text-scifi-muted mt-3 mb-0 font-mono">site · {site.id}</p>
{:else}
	<div class="empty-pane">
		<p class="m-0 text-sm text-scifi-muted mb-3">
			Create a site first — the install snippet is site-scoped.
		</p>
		<button type="button" class="btn btn-primary btn-sm" onclick={onGoToSites}>
			Add a site
		</button>
	</div>
{/if}
