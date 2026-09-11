<script lang="ts">
	import StatCard from '$lib/components/StatCard.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import GeoGlobe from '$lib/components/GeoGlobe.svelte';
	import { relTime } from '$lib/rel-time';

	type RankStat = { label: string; views: number };
	type GeoCity = {
		city: string;
		country: string;
		lat: number;
		lng: number;
		views: number;
	};

	type Stats = {
		pageviews: number;
		visitors: number;
		bounceRate: number;
		avgPagesPerVisit: number;
		avgVisitDurationSec: number;
		topPages: { path: string; views: number }[];
		topReferrers: { referrer: string; views: number }[];
		browsers: { browser: string; views: number }[];
		operatingSystems: { os: string; views: number }[];
		devices: { device: string; views: number }[];
		languages: RankStat[];
		screens: RankStat[];
		utmSources: RankStat[];
		utmMediums: RankStat[];
		campaigns: RankStat[];
		countries: RankStat[];
		cities: GeoCity[];
		customEvents: RankStat[];
		timeseries: { date: string; pageviews: number; visitors: number }[];
	};

	type EventRow = {
		id: number | string;
		name?: string;
		path: string;
		referrer: string | null;
		title: string | null;
		browser: string | null;
		os: string | null;
		device: string | null;
		country?: string | null;
		city?: string | null;
		created_at: number;
	};

	let {
		site,
		stats,
		recentEvents,
		days,
		live = true,
		kicker = '// Mission control',
		emptyStream = 'No events yet — the stream is listening.'
	}: {
		site: { id: string; name: string; domain: string };
		stats: Stats;
		recentEvents: EventRow[];
		days: number;
		live?: boolean;
		kicker?: string;
		emptyStream?: string;
	} = $props();

	const maxPageViews = $derived(Math.max(1, ...stats.topPages.map((r) => r.views), 1));
	const maxRefViews = $derived(Math.max(1, ...stats.topReferrers.map((r) => r.views), 1));
	const maxBrowserViews = $derived(Math.max(1, ...stats.browsers.map((r) => r.views), 1));
	const maxOsViews = $derived(Math.max(1, ...stats.operatingSystems.map((r) => r.views), 1));
	const maxDeviceViews = $derived(Math.max(1, ...stats.devices.map((r) => r.views), 1));
	const maxLangViews = $derived(Math.max(1, ...stats.languages.map((r) => r.views), 1));
	const maxScreenViews = $derived(Math.max(1, ...stats.screens.map((r) => r.views), 1));
	const maxSourceViews = $derived(Math.max(1, ...stats.utmSources.map((r) => r.views), 1));
	const maxMediumViews = $derived(Math.max(1, ...stats.utmMediums.map((r) => r.views), 1));
	const maxCampaignViews = $derived(Math.max(1, ...stats.campaigns.map((r) => r.views), 1));
	const maxCountryViews = $derived(Math.max(1, ...stats.countries.map((r) => r.views), 1));
	const maxEventViews = $derived(Math.max(1, ...stats.customEvents.map((r) => r.views), 1));

	function techLine(e: EventRow): string {
		const geo = [e.city, e.country].filter(Boolean).join(', ');
		return [e.browser, e.os, e.device, geo].filter(Boolean).join(' · ') || '—';
	}

	function streamLabel(e: EventRow): string {
		if (e.name && e.name !== 'pageview') return e.name;
		const path = e.path.split('?')[0] || '/';
		if (e.title && e.title.trim()) return e.title.trim();
		return path;
	}

	function formatDuration(sec: number): string {
		if (!sec) return '0s';
		if (sec < 60) return `${sec}s`;
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return s ? `${m}m ${s}s` : `${m}m`;
	}
</script>

<section class="mission-deck" data-deck>
	<div class="mission-head">
		<div class="min-w-0">
			<p class="label-kicker text-scifi-primary m-0 mb-1">{kicker}</p>
			<h1
				class="hero-title hero-title-glitch text-3xl sm:text-4xl font-extrabold tracking-tight leading-none m-0"
				data-text={site.name.toUpperCase()}
			>
				{site.name.toUpperCase()}
			</h1>
			<p class="text-scifi-muted text-[0.7rem] tracking-[0.14em] uppercase mt-2 mb-0">
				{site.domain} · last {days}d · {stats.pageviews.toLocaleString()} hits
			</p>
		</div>
		<div class="mission-meta">
			<span class="status-chip">
				<span
					class="dot"
					style={live
						? ''
						: 'background: var(--scifi-muted); box-shadow: none; animation: none;'}
				></span>
				{live ? 'ingesting' : 'frozen'}
			</span>
		</div>
	</div>
	<div class="mission-metrics">
		<StatCard label="Pageviews" value={stats.pageviews} />
		<StatCard label="Visitors" value={stats.visitors} />
		<StatCard label="Bounce rate" value={stats.bounceRate} suffix="%" />
		<StatCard label="Pages / visit" value={stats.avgPagesPerVisit} />
		<StatCard
			label="Avg duration"
			value={formatDuration(stats.avgVisitDurationSec ?? 0)}
		/>
	</div>
</section>

<section class="signal-panel" data-deck>
	<div class="pane-header !bg-transparent">
		<span class="pane-title"><span class="pane-title-bar"></span> Signal over time</span>
		<span class="legend">
			<span class="legend-item">
				<span class="legend-line legend-pv"></span> pageviews
			</span>
			<span class="legend-item">
				<span class="legend-line legend-vis"></span> visitors
			</span>
		</span>
	</div>
	<div class="signal-chart">
		<div class="pane-scan"></div>
		<Sparkline data={stats.timeseries} />
	</div>
</section>

<section class="globe-panel" data-deck>
	<div class="pane-header">
		<span class="pane-title"><span class="pane-title-bar"></span> Earth</span>
		<span class="text-scifi-muted text-[0.62rem] tracking-[0.12em] uppercase">
			{stats.cities.length} cities · {stats.countries.length} countries
		</span>
	</div>
	<div class="globe-layout">
		<GeoGlobe cities={stats.cities} height={360} />
		<div class="geo-columns">
			<div class="rank-body !pt-0 geo-col">
				<p class="label-kicker m-0 mb-2">Countries</p>
				{#each stats.countries.slice(0, 10) as row, i}
					<div class="rank-row">
						<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
						<div class="rank-main min-w-0">
							<div class="flex justify-between gap-2 text-xs mb-1">
								<span class="truncate">{row.label}</span>
								<span class="text-scifi-muted tabular-nums shrink-0"
									>{row.views.toLocaleString()}</span
								>
							</div>
							<div class="meter-track">
								<div
									class="meter-fill meter-fill-cyan"
									style="width: {(row.views / maxCountryViews) * 100}%"
								></div>
							</div>
						</div>
					</div>
				{:else}
					<p class="text-scifi-muted text-xs m-0">No country data yet</p>
				{/each}
			</div>
			<div class="rank-body !pt-0 geo-col">
				<p class="label-kicker m-0 mb-2">Cities</p>
				{#each stats.cities.slice(0, 10) as row, i}
					<div class="rank-row">
						<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
						<div class="rank-main min-w-0">
							<div class="flex justify-between gap-2 text-xs mb-1">
								<span
									class="truncate"
									title="{row.city}, {row.country} · {row.lat.toFixed(2)}°, {row.lng.toFixed(2)}°"
									>{row.city}, {row.country}</span
								>
								<span class="text-scifi-muted tabular-nums shrink-0"
									>{row.views.toLocaleString()}</span
								>
							</div>
							<div class="meter-track">
								<div
									class="meter-fill"
									style="width: {(row.views / Math.max(1, stats.cities[0]?.views ?? 1)) * 100}%"
								></div>
							</div>
						</div>
					</div>
				{:else}
					<p class="text-scifi-muted text-xs m-0">No city data yet</p>
				{/each}
			</div>
		</div>
	</div>
</section>

<div class="bento" data-deck>
	<section class="stream-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Event stream</span>
			<span class="status-chip">
				<span
					class="dot"
					style={live
						? ''
						: 'background: var(--scifi-muted); box-shadow: none; animation: none;'}
				></span>
				{live ? 'live' : 'paused'}
			</span>
		</div>
		<ul class="stream-list">
			{#each recentEvents as e (e.id)}
				<li class="stream-row">
					<span class="stream-time">{relTime(e.created_at)}</span>
					<span class="stream-main min-w-0">
						<span class="stream-path truncate" title={e.path}>{streamLabel(e)}</span>
						<span class="stream-tech truncate">{techLine(e)}</span>
					</span>
					<span class="stream-ref truncate">{e.referrer ?? 'direct'}</span>
				</li>
			{:else}
				<li class="stream-empty">{emptyStream}</li>
			{/each}
		</ul>
	</section>

	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Top pages</span>
		</div>
		<div class="rank-body">
			{#each stats.topPages.slice(0, 8) as row, i}
				<div class="rank-row">
					<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
					<div class="rank-main min-w-0">
						<div class="flex justify-between gap-2 text-xs mb-1">
							<span class="truncate">{row.path}</span>
							<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
						</div>
						<div class="meter-track">
							<div class="meter-fill" style="width: {(row.views / maxPageViews) * 100}%"></div>
						</div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">No traffic yet</p>
			{/each}
		</div>
	</section>
</div>

<div class="bento" data-deck>
	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Referrers</span>
		</div>
		<div class="rank-body">
			{#each stats.topReferrers.slice(0, 8) as row, i}
				<div class="rank-row">
					<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
					<div class="rank-main min-w-0">
						<div class="flex justify-between gap-2 text-xs mb-1">
							<span class="truncate">{row.referrer}</span>
							<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
						</div>
						<div class="meter-track">
							<div
								class="meter-fill meter-fill-cyan"
								style="width: {(row.views / maxRefViews) * 100}%"
							></div>
						</div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">No referrers yet</p>
			{/each}
		</div>
	</section>

	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Campaigns</span>
		</div>
		<div class="rank-body grid sm:grid-cols-3 gap-5">
			<div class="space-y-2.5">
				<p class="label-kicker m-0">Sources</p>
				{#each stats.utmSources.slice(0, 5) as row}
					<div>
						<div class="flex justify-between gap-2 text-xs mb-1">
							<span class="truncate">{row.label}</span>
							<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
						</div>
						<div class="meter-track">
							<div
								class="meter-fill meter-fill-cyan"
								style="width: {(row.views / maxSourceViews) * 100}%"
							></div>
						</div>
					</div>
				{:else}
					<p class="text-scifi-muted text-xs m-0">No UTM sources yet</p>
				{/each}
			</div>
			<div class="space-y-2.5">
				<p class="label-kicker m-0">Mediums</p>
				{#each stats.utmMediums.slice(0, 5) as row}
					<div>
						<div class="flex justify-between gap-2 text-xs mb-1">
							<span class="truncate">{row.label}</span>
							<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
						</div>
						<div class="meter-track">
							<div
								class="meter-fill meter-fill-secondary"
								style="width: {(row.views / maxMediumViews) * 100}%"
							></div>
						</div>
					</div>
				{:else}
					<p class="text-scifi-muted text-xs m-0">No mediums yet</p>
				{/each}
			</div>
			<div class="space-y-2.5">
				<p class="label-kicker m-0">Campaigns</p>
				{#each stats.campaigns.slice(0, 5) as row}
					<div>
						<div class="flex justify-between gap-2 text-xs mb-1">
							<span class="truncate">{row.label}</span>
							<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
						</div>
						<div class="meter-track">
							<div class="meter-fill" style="width: {(row.views / maxCampaignViews) * 100}%"></div>
						</div>
					</div>
				{:else}
					<p class="text-scifi-muted text-xs m-0">No campaigns yet</p>
				{/each}
			</div>
		</div>
	</section>
</div>

<div class="bento bento-3" data-deck>
	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Browsers</span>
		</div>
		<div class="rank-body">
			{#each stats.browsers.slice(0, 5) as row}
				<div>
					<div class="flex justify-between gap-2 text-xs mb-1">
						<span class="truncate">{row.browser}</span>
						<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
					</div>
					<div class="meter-track">
						<div class="meter-fill" style="width: {(row.views / maxBrowserViews) * 100}%"></div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">—</p>
			{/each}
		</div>
	</section>

	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> OS</span>
		</div>
		<div class="rank-body">
			{#each stats.operatingSystems.slice(0, 5) as row}
				<div>
					<div class="flex justify-between gap-2 text-xs mb-1">
						<span class="truncate">{row.os}</span>
						<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
					</div>
					<div class="meter-track">
						<div
							class="meter-fill meter-fill-cyan"
							style="width: {(row.views / maxOsViews) * 100}%"
						></div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">—</p>
			{/each}
		</div>
	</section>

	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Devices</span>
		</div>
		<div class="rank-body">
			{#each stats.devices.slice(0, 5) as row}
				<div>
					<div class="flex justify-between gap-2 text-xs mb-1">
						<span class="truncate">{row.device}</span>
						<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
					</div>
					<div class="meter-track">
						<div
							class="meter-fill meter-fill-secondary"
							style="width: {(row.views / maxDeviceViews) * 100}%"
						></div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">—</p>
			{/each}
		</div>
	</section>
</div>

<div class="bento bento-2" data-deck>
	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Languages</span>
		</div>
		<div class="rank-body">
			{#each stats.languages.slice(0, 5) as row}
				<div>
					<div class="flex justify-between gap-2 text-xs mb-1">
						<span class="truncate">{row.label}</span>
						<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
					</div>
					<div class="meter-track">
						<div class="meter-fill" style="width: {(row.views / maxLangViews) * 100}%"></div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">—</p>
			{/each}
		</div>
	</section>

	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Screens</span>
		</div>
		<div class="rank-body">
			{#each stats.screens.slice(0, 5) as row}
				<div>
					<div class="flex justify-between gap-2 text-xs mb-1">
						<span class="truncate">{row.label}</span>
						<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
					</div>
					<div class="meter-track">
						<div
							class="meter-fill meter-fill-secondary"
							style="width: {(row.views / maxScreenViews) * 100}%"
						></div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">—</p>
			{/each}
		</div>
	</section>
</div>

<div class="bento bento-single" data-deck>
	<section class="rank-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Custom events</span>
		</div>
		<div class="rank-body">
			<p class="text-scifi-muted text-[0.65rem] m-0 mb-2 tracking-wide">
				<code class="text-scifi-cyan">statsman.track('name', data?)</code>
			</p>
			{#each stats.customEvents.slice(0, 8) as row, i}
				<div class="rank-row">
					<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
					<div class="rank-main min-w-0">
						<div class="flex justify-between gap-2 text-xs mb-1">
							<span class="truncate">{row.label}</span>
							<span class="text-scifi-muted tabular-nums shrink-0">{row.views.toLocaleString()}</span>
						</div>
						<div class="meter-track">
							<div class="meter-fill" style="width: {(row.views / maxEventViews) * 100}%"></div>
						</div>
					</div>
				</div>
			{:else}
				<p class="text-scifi-muted text-xs m-0">No custom events yet — fire one from your site.</p>
			{/each}
		</div>
	</section>
</div>

<style>
	.mission-deck,
	.signal-panel,
	.globe-panel,
	.stream-panel,
	.rank-panel {
		position: relative;
		overflow: hidden;
		border-radius: 14px;
		border: 1px solid var(--scifi-border-accent);
		background: linear-gradient(
			165deg,
			rgba(var(--scifi-surface-1-rgb), 0.78),
			rgba(var(--scifi-surface-2-rgb), 0.9)
		);
		box-shadow: 0 16px 48px -24px rgba(var(--scifi-shadow-rgb), 0.5);
	}

	.mission-deck {
		padding: 1.25rem 1.25rem 1.15rem;
	}
	.mission-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.1rem;
	}
	.mission-metrics {
		display: grid;
		gap: 0.65rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	@media (min-width: 1024px) {
		.mission-metrics {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	.signal-panel :global(.pane-header) {
		border-bottom: 1px solid var(--scifi-border);
		background: transparent;
	}
	.signal-chart {
		position: relative;
		padding: 0.75rem 0.85rem 1rem;
	}
	.globe-layout {
		display: grid;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem 1rem;
	}
	.geo-columns {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: 1fr 1fr;
		min-height: 0;
	}
	.geo-col {
		max-height: 360px;
		overflow: auto;
		padding-left: 0;
		padding-right: 0.25rem;
	}
	@media (min-width: 1100px) {
		.globe-layout {
			grid-template-columns: 1.35fr 1fr;
			align-items: stretch;
		}
	}
	@media (max-width: 700px) {
		.geo-columns {
			grid-template-columns: 1fr;
		}
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--scifi-muted);
	}
	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.legend-line {
		width: 0.7rem;
		height: 2px;
		border-radius: 999px;
	}
	.legend-pv {
		background: var(--scifi-primary);
		box-shadow: 0 0 6px var(--scifi-primary-glow);
	}
	.legend-vis {
		background: var(--scifi-cyan);
		box-shadow: 0 0 6px var(--scifi-cyan-glow);
	}

	.bento {
		display: grid;
		gap: 1rem;
	}
	.bento-single {
		grid-template-columns: 1fr;
	}
	.bento-2 {
		grid-template-columns: 1fr;
	}
	.bento-3 {
		grid-template-columns: 1fr;
	}
	@media (min-width: 768px) {
		.bento-2 {
			grid-template-columns: 1fr 1fr;
		}
		.bento-3 {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.bento:not(.bento-single):not(.bento-2):not(.bento-3) {
			grid-template-columns: 1fr 1fr;
		}
	}

	.stream-list {
		list-style: none;
		margin: 0;
		padding: 0.65rem 0.85rem 0.9rem;
		min-height: 12rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.stream-row {
		display: grid;
		grid-template-columns: 3.6rem 1fr auto;
		gap: 0.55rem;
		align-items: center;
		padding: 0.4rem 0.45rem;
		border-radius: 8px;
		font-size: 0.75rem;
		background: rgba(var(--scifi-bg-deep-rgb), 0.25);
		border: 1px solid transparent;
	}
	.stream-row:first-child {
		border-color: rgba(var(--scifi-primary-rgb), 0.25);
		background: rgba(var(--scifi-primary-rgb), 0.07);
		animation: feed-in 0.45s var(--scifi-ease, ease-out);
	}
	.stream-time {
		font-variant-numeric: tabular-nums;
		color: var(--scifi-muted);
		font-size: 0.68rem;
	}
	.stream-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.stream-tech {
		color: var(--scifi-muted);
		font-size: 0.62rem;
		letter-spacing: 0.02em;
	}
	.stream-ref {
		color: var(--scifi-cyan);
		max-width: 7rem;
		font-size: 0.68rem;
	}
	.stream-empty {
		padding: 1.5rem 0.5rem;
		color: var(--scifi-muted);
		font-size: 0.8rem;
	}

	.rank-body {
		padding: 0.75rem 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.rank-row {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
	}
	.rank-idx {
		font-family: var(--scifi-font-mono, ui-monospace, monospace);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		color: var(--scifi-muted);
		padding-top: 0.15rem;
		opacity: 0.75;
	}

	.meter-track {
		height: 4px;
		border-radius: 999px;
		background: rgba(var(--scifi-muted-rgb), 0.15);
		overflow: hidden;
	}
	.meter-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--scifi-primary), var(--scifi-secondary));
		box-shadow: 0 0 8px var(--scifi-primary-glow);
		transition: width 0.7s var(--scifi-ease, ease-out);
	}
	.meter-fill-cyan {
		background: linear-gradient(90deg, var(--scifi-cyan), var(--scifi-secondary));
		box-shadow: 0 0 8px var(--scifi-cyan-glow);
	}
	.meter-fill-secondary {
		background: linear-gradient(90deg, var(--scifi-secondary), var(--scifi-primary));
		box-shadow: 0 0 8px var(--scifi-secondary-glow);
	}

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

	@media (prefers-reduced-motion: reduce) {
		.stream-row:first-child {
			animation: none;
		}
	}
</style>
