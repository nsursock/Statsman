<script lang="ts">
	import { browser } from '$app/environment';

	type Insight = {
		kind: string;
		severity: 'info' | 'notable' | 'significant';
		title: string;
		detail: string;
		change: number | null;
	};

	type ExplainResponse = {
		insights: Insight[];
		summary: string | null;
		aiPowered: boolean;
		aiAvailable: boolean;
	};

	let {
		siteId,
		siteName,
		days,
		aiAvailable = false
	}: {
		siteId: string;
		siteName: string;
		days: number;
		aiAvailable?: boolean;
	} = $props();

	// ── Drawer state ───────────────────────────────────────────────
	let open = $state(false);

	// ── Explain state ──────────────────────────────────────────────
	let insights: Insight[] = $state([]);
	let summary: string | null = $state(null);
	let aiPowered = $state(false);
	let loading = $state(false);
	let error: string | null = $state(null);
	/** Track what we last fetched so we don't refetch on every poll cycle. */
	let lastSiteId = '';
	let lastDays = 0;

	// ── Ask state ──────────────────────────────────────────────────
	let question = $state('');
	let answer = $state('');
	let asking = $state(false);
	let askError: string | null = $state(null);
	let abortController: AbortController | null = null;

	const exampleQuestions = [
		'Why did traffic spike?',
		'Where are my visitors coming from?',
		'Which pages perform best?',
		'Compare this week with last week'
	];

	const severityIcon: Record<string, string> = {
		traffic_spike: '\u26A1',
		traffic_drop: '\u2B07',
		visitor_change: '\u{1F4C8}',
		source_breakout: '\u{1F525}',
		page_breakout: '\u{1F4C4}',
		new_country: '\u{1F30D}',
		engagement_change: '\u{1F4CA}'
	};

	async function fetchExplain() {
		if (!browser || !siteId) return;
		// Only show full loading spinner on first load — keep existing
		// insights visible during background refetches to avoid flashing.
		const isFirstLoad = insights.length === 0 && !summary;
		loading = isFirstLoad;
		error = null;
		try {
			const res = await fetch('/api/ai/explain', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteId, days })
			});
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			const data = (await res.json()) as ExplainResponse;
			insights = data.insights;
			summary = data.summary;
			aiPowered = data.aiPowered;
			aiAvailable = data.aiAvailable;
			lastSiteId = siteId;
			lastDays = days;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load insights';
		} finally {
			loading = false;
		}
	}

	async function submitQuestion(q?: string) {
		const text = (q ?? question).trim();
		if (!text || asking) return;
		question = text;
		answer = '';
		askError = null;
		asking = true;

		abortController?.abort();
		abortController = new AbortController();

		try {
			const res = await fetch('/api/ai/ask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteId, question: text, days }),
				signal: abortController.signal
			});

			if (!res.ok) {
				const msg = await res.text().catch(() => `Failed (${res.status})`);
				throw new Error(msg);
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error('No response stream');
			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				answer += decoder.decode(value, { stream: true });
			}
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') return;
			askError = e instanceof Error ? e.message : 'Failed to get answer';
		} finally {
			asking = false;
		}
	}

	function stopAnswer() {
		abortController?.abort();
		asking = false;
	}

	function clearAnswer() {
		answer = '';
		askError = null;
		question = '';
	}

	function toggle() {
		open = !open;
	}

	// Fetch on mount and when site/days actually change.
	// We compare against lastSiteId/lastDays so that parent re-renders
	// (e.g. live polling with invalidateAll) don't trigger a refetch
	// when the values haven't actually changed.
	$effect(() => {
		void siteId;
		void days;
		if (!browser) return;
		if (siteId === lastSiteId && days === lastDays && (insights.length > 0 || summary)) return;
		fetchExplain();
	});

	// Close on Escape
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
		}
	}

	let insightCount = $derived(insights.length);
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Floating toggle button -->
<button
	type="button"
	class="ai-fab"
	class:ai-fab--active={open}
	onclick={toggle}
	aria-label={open ? 'Close AI Analyst' : 'Open AI Analyst'}
	aria-expanded={open}
>
	{#if open}
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M18 6L6 18M6 6l12 12" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M12 2L2 7l10 5 10-5-10-5z" />
			<path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
		</svg>
	{/if}
	{#if !open && insightCount > 0}
		<span class="ai-fab-badge" aria-label="{insightCount} insights">{insightCount}</span>
	{/if}
</button>

<!-- Backdrop -->
{#if open}
	<div class="ai-backdrop" onclick={() => (open = false)} aria-hidden="true"></div>
{/if}

<!-- Sliding drawer panel -->
<aside
	class="ai-drawer"
	class:ai-drawer--open={open}
	aria-label="AI Analyst"
	aria-hidden={!open}
>
	<div class="drawer-panel ai-drawer-panel">
		<!-- Header -->
		<div class="pane-header ai-drawer-header">
			<span class="pane-title">
				<span class="pane-title-bar"></span>
				AI Analyst
			</span>
			<div class="flex items-center gap-2">
				<span class="status-chip">
					<span
						class="dot"
						style={aiAvailable
							? ''
							: 'background: var(--scifi-muted); box-shadow: none; animation: none;'}
					></span>
					{aiAvailable ? 'active' : 'no key'}
				</span>
				<button
					type="button"
					class="ai-close-btn"
					onclick={() => (open = false)}
					aria-label="Close"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Body -->
		<div class="ai-drawer-body">
			<p class="ai-site-label">{siteName}</p>

			<!-- Explain: detected insights -->
			{#if loading}
				<div class="ai-loading">
					<span class="ai-pulse" aria-hidden="true"></span>
					<span class="text-scifi-muted text-xs">Analyzing traffic patterns…</span>
				</div>
			{:else if error}
				<p class="text-scifi-muted text-xs m-0">{error}</p>
			{:else}
				{#if summary}
					<p class="ai-summary m-0 mb-3">{summary}</p>
				{/if}

				{#if insights.length > 0}
					<p class="label-kicker m-0 mb-2">
						{#if aiPowered}AI detected{:else}Detected{/if} · {insights.length}
					</p>
					<ul class="ai-insights m-0 p-0 list-none space-y-2">
						{#each insights.slice(0, 6) as ins}
							<li class="ai-insight ai-sev-{ins.severity}">
								<span class="ai-insight-icon" aria-hidden="true">
									{severityIcon[ins.kind] ?? '\u2022'}
								</span>
								<div class="min-w-0">
									<p class="ai-insight-title m-0">{ins.title}</p>
									<p class="ai-insight-detail m-0">{ins.detail}</p>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-scifi-muted text-xs m-0">
						Traffic is steady — nothing unusual detected.
					</p>
				{/if}
			{/if}

			<!-- Ask: question box -->
			{#if aiAvailable}
				<div class="ai-ask mt-4 pt-3">
					{#if answer || askError}
						<div class="ai-answer">
							{#if askError}
								<p class="text-scifi-error text-xs m-0">{askError}</p>
							{:else}
								<p class="ai-answer-text m-0">{answer}{#if asking}<span class="ai-cursor">▋</span>{/if}</p>
							{/if}
							<div class="ai-answer-actions mt-2">
								{#if asking}
									<button type="button" class="btn btn-ghost btn-xs" onclick={stopAnswer}>Stop</button>
								{:else}
									<button type="button" class="btn btn-ghost btn-xs" onclick={clearAnswer}>Clear</button>
								{/if}
							</div>
						</div>
					{/if}

					{#if !answer && !askError}
						<div class="ai-examples mb-2">
							{#each exampleQuestions.slice(0, 3) as ex}
								<button
									type="button"
									class="ai-example-chip"
									onclick={() => submitQuestion(ex)}
									disabled={asking}
								>
									{ex}
								</button>
							{/each}
						</div>
					{/if}

					<form
						class="ai-ask-form"
						onsubmit={(e) => {
							e.preventDefault();
							submitQuestion();
						}}
					>
						<input
							type="text"
							class="ai-ask-input"
							placeholder="Ask Statsman anything…"
							bind:value={question}
							disabled={asking}
							maxlength="1000"
						/>
						<button
							type="submit"
							class="ai-ask-btn"
							disabled={asking || !question.trim()}
							aria-label="Ask"
						>
							{#if asking}
								<span class="ai-pulse" aria-hidden="true"></span>
							{:else}
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
								</svg>
							{/if}
						</button>
					</form>
				</div>
			{:else}
				<div class="ai-setup-hint mt-4 pt-3">
					<p class="text-scifi-muted text-xs m-0">
						Set <code class="text-scifi-cyan">OPENROUTER_API_KEY</code> to enable the Ask box.
					</p>
				</div>
			{/if}
		</div>
	</div>
</aside>

<style>
	/* ── Floating action button ──────────────────────────────────── */
	.ai-fab {
		position: fixed;
		bottom: 1.25rem;
		right: 1.25rem;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 14px;
		border: 1px solid var(--scifi-primary);
		background: linear-gradient(
			145deg,
			rgba(var(--scifi-primary-rgb), 0.18),
			rgba(var(--scifi-surface-1-rgb), 0.95)
		);
		color: var(--scifi-primary);
		cursor: pointer;
		box-shadow:
			0 8px 28px -10px rgba(var(--scifi-shadow-rgb), 0.6),
			0 0 16px -4px rgba(var(--scifi-primary-rgb), 0.3);
		transition:
			transform 0.2s var(--scifi-ease),
			box-shadow 0.2s var(--scifi-ease),
			opacity 0.2s;
	}
	.ai-fab:hover {
		transform: translateY(-2px);
		box-shadow:
			0 12px 36px -10px rgba(var(--scifi-shadow-rgb), 0.7),
			0 0 24px -2px rgba(var(--scifi-primary-rgb), 0.45);
	}
	.ai-fab--active {
		transform: rotate(90deg);
		opacity: 0;
		pointer-events: none;
	}

	.ai-fab-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 1.1rem;
		height: 1.1rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--scifi-primary);
		color: var(--scifi-surface-0, #0a0a0f);
		font-size: 0.6rem;
		font-weight: 700;
		line-height: 1.1rem;
		text-align: center;
		box-shadow: 0 0 8px rgba(var(--scifi-primary-rgb), 0.5);
	}

	/* ── Backdrop ────────────────────────────────────────────────── */
	.ai-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
		background: rgba(var(--scifi-backdrop-rgb), 0.45);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		animation: ai-fade-in 0.2s ease both;
	}
	@keyframes ai-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* ── Drawer panel ────────────────────────────────────────────── */
	.ai-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 60;
		width: min(24rem, 90vw);
		transform: translateX(100%);
		transition: transform 0.28s var(--scifi-ease);
		pointer-events: none;
	}
	.ai-drawer--open {
		transform: translateX(0);
		pointer-events: auto;
	}

	.ai-drawer-panel {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--scifi-border);
		box-shadow: -12px 0 40px -16px rgba(var(--scifi-shadow-rgb), 0.6);
	}

	.ai-drawer-header {
		flex-shrink: 0;
		padding: 0.75rem 1rem;
	}

	.ai-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 8px;
		border: 1px solid var(--scifi-border-accent);
		background: transparent;
		color: var(--scifi-muted);
		cursor: pointer;
		transition: all 0.15s;
	}
	.ai-close-btn:hover {
		color: var(--scifi-text);
		border-color: var(--scifi-primary);
	}

	.ai-drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1rem 1rem;
	}

	.ai-site-label {
		font-size: 0.65rem;
		color: var(--scifi-muted);
		margin: 0 0 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* ── Loading ─────────────────────────────────────────────────── */
	.ai-loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ai-pulse {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--scifi-primary);
		box-shadow: 0 0 8px var(--scifi-primary-glow);
		animation: ai-pulse 1.2s ease-in-out infinite;
		flex-shrink: 0;
	}
	@keyframes ai-pulse {
		0%, 100% { opacity: 0.4; transform: scale(0.85); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	/* ── Summary ─────────────────────────────────────────────────── */
	.ai-summary {
		font-size: 0.82rem;
		line-height: 1.55;
		color: var(--scifi-text, #e0e0e0);
	}

	/* ── Insights ────────────────────────────────────────────────── */
	.ai-insights {
		display: flex;
		flex-direction: column;
	}

	.ai-insight {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 0.5rem 0.6rem;
		border-radius: 8px;
		background: rgba(var(--scifi-surface-1-rgb), 0.4);
		border-left: 2px solid var(--scifi-muted);
	}
	.ai-sev-significant {
		border-left-color: var(--scifi-primary);
		background: rgba(var(--scifi-primary-rgb), 0.06);
	}
	.ai-sev-notable {
		border-left-color: var(--scifi-cyan);
	}

	.ai-insight-icon {
		font-size: 0.9rem;
		line-height: 1.4;
		flex-shrink: 0;
	}

	.ai-insight-title {
		font-size: 0.78rem;
		font-weight: 600;
		margin-bottom: 0.15rem;
	}

	.ai-insight-detail {
		font-size: 0.68rem;
		color: var(--scifi-muted);
		line-height: 1.45;
	}

	/* ── Ask box ─────────────────────────────────────────────────── */
	.ai-ask {
		border-top: 1px solid var(--scifi-border-accent);
	}

	.ai-examples {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.ai-example-chip {
		font-size: 0.65rem;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--scifi-border-accent);
		background: rgba(var(--scifi-surface-1-rgb), 0.3);
		color: var(--scifi-muted);
		cursor: pointer;
		transition: all 0.15s;
	}
	.ai-example-chip:hover:not(:disabled) {
		border-color: var(--scifi-cyan);
		color: var(--scifi-cyan);
		background: rgba(var(--scifi-cyan-rgb), 0.06);
	}
	.ai-example-chip:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.ai-ask-form {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.ai-ask-input {
		flex: 1;
		min-width: 0;
		padding: 0.45rem 0.7rem;
		font-size: 0.78rem;
		border-radius: 8px;
		border: 1px solid var(--scifi-border-accent);
		background: rgba(var(--scifi-surface-1-rgb), 0.5);
		color: var(--scifi-text, #e0e0e0);
		outline: none;
		transition: border-color 0.15s;
	}
	.ai-ask-input:focus {
		border-color: var(--scifi-primary);
		box-shadow: 0 0 0 2px rgba(var(--scifi-primary-rgb), 0.12);
	}
	.ai-ask-input::placeholder {
		color: var(--scifi-muted);
	}

	.ai-ask-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 8px;
		border: 1px solid var(--scifi-primary);
		background: rgba(var(--scifi-primary-rgb), 0.1);
		color: var(--scifi-primary);
		cursor: pointer;
		transition: all 0.15s;
	}
	.ai-ask-btn:hover:not(:disabled) {
		background: rgba(var(--scifi-primary-rgb), 0.2);
		box-shadow: 0 0 12px rgba(var(--scifi-primary-rgb), 0.3);
	}
	.ai-ask-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.ai-answer {
		padding: 0.6rem 0.7rem;
		border-radius: 8px;
		background: rgba(var(--scifi-cyan-rgb), 0.04);
		border: 1px solid rgba(var(--scifi-cyan-rgb), 0.15);
		margin-bottom: 0.6rem;
	}

	.ai-answer-text {
		font-size: 0.78rem;
		line-height: 1.55;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.ai-cursor {
		display: inline-block;
		color: var(--scifi-cyan);
		animation: ai-blink 0.8s step-end infinite;
	}
	@keyframes ai-blink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	.ai-answer-actions {
		display: flex;
		gap: 0.4rem;
	}

	.ai-setup-hint code {
		font-size: 0.65rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.ai-pulse,
		.ai-cursor,
		.ai-fab,
		.ai-drawer,
		.ai-backdrop {
			animation: none;
			transition: none;
		}
	}
</style>
