<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import StatCard from '$lib/components/StatCard.svelte';
	import Sparkline, { type BarRange } from '$lib/components/Sparkline.svelte';
	import GeoGlobe from '$lib/components/GeoGlobe.svelte';
	import { countryName } from '$lib/country-name';
	import { relTime } from '$lib/rel-time';
	import { POINT_PRESETS, type ChartType } from '$lib/timeseries';

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
		points = 96,
		chart = 'line',
		live = true,
		kicker = '// Mission control',
		emptyStream = 'No events yet — the stream is listening.',
		onPointsChange,
		onChartChange,
		onLiveChange
	}: {
		site: { id: string; name: string; domain: string };
		stats: Stats;
		recentEvents: EventRow[];
		days: number;
		points?: number;
		chart?: ChartType;
		live?: boolean;
		kicker?: string;
		emptyStream?: string;
		onPointsChange?: (points: number) => void;
		onChartChange?: (chart: ChartType) => void;
		onLiveChange?: (live: boolean) => void;
	} = $props();

	// Drill-down: click a bar to filter the deck to that bucket's time window.
	let drillStats = $state<Stats | null>(null);
	let drillEvents = $state<EventRow[] | null>(null);
	let drillLabel = $state('');
	let drillLoading = $state(false);
	let selectedBar = $state(-1);
	const displayStats = $derived(drillStats ?? stats);
	const displayEvents = $derived(drillEvents ?? recentEvents);

	// Reset drill-down whenever the underlying stats change (range/points/live refresh).
	$effect(() => {
		stats;
		drillStats = null;
		drillEvents = null;
		drillLabel = '';
		selectedBar = -1;
	});

	async function onBarClick(range: BarRange) {
		if (!browser) return;
		// Toggle off if the same bar is clicked again.
		if (selectedBar === range.index && drillStats) {
			clearDrill();
			return;
		}
		selectedBar = range.index;
		drillLoading = true;
		drillLabel = formatRangeLabel(range.start, range.end);
		// Clicking a bar pauses live refresh so the drilled snapshot stays stable.
		// If already paused, leave it alone.
		if (live) onLiveChange?.(false);
		try {
			const res = await fetch(
				`/api/stats/range?siteId=${encodeURIComponent(site.id)}&startMs=${range.start}&endMs=${range.end}&points=${points}`
			);
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Failed to load range');
			drillStats = payload.stats as Stats;
			drillEvents = (payload.recentEvents as EventRow[]) ?? [];
		} catch {
			drillStats = null;
			drillEvents = null;
			selectedBar = -1;
			drillLabel = '';
		} finally {
			drillLoading = false;
		}
	}

	function clearDrill() {
		drillStats = null;
		drillEvents = null;
		drillLabel = '';
		selectedBar = -1;
		// Return to normal timeframe: fetch fresh full-range stats.
		// Live mode is left untouched — bar interaction never resumes it.
		if (browser) void invalidateAll();
	}

	function formatRangeLabel(start: number, end: number): string {
		const s = new Date(start);
		const e = new Date(end);
		const day = 24 * 60 * 60 * 1000;
		if (end - start <= 2 * 60 * 60 * 1000) {
			return `${s.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', hour12: false })} – ${e.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
		}
		if (end - start <= day) {
			return `${s.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', hour12: false })} – ${e.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
		}
		return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
	}

	const maxPageViews = $derived(Math.max(1, ...displayStats.topPages.map((r) => r.views), 1));
	const maxRefViews = $derived(Math.max(1, ...displayStats.topReferrers.map((r) => r.views), 1));
	const maxBrowserViews = $derived(Math.max(1, ...displayStats.browsers.map((r) => r.views), 1));
	const maxOsViews = $derived(Math.max(1, ...displayStats.operatingSystems.map((r) => r.views), 1));
	const maxDeviceViews = $derived(Math.max(1, ...displayStats.devices.map((r) => r.views), 1));
	const maxLangViews = $derived(Math.max(1, ...displayStats.languages.map((r) => r.views), 1));
	const maxScreenViews = $derived(Math.max(1, ...displayStats.screens.map((r) => r.views), 1));
	const maxSourceViews = $derived(Math.max(1, ...displayStats.utmSources.map((r) => r.views), 1));
	const maxMediumViews = $derived(Math.max(1, ...displayStats.utmMediums.map((r) => r.views), 1));
	const maxCampaignViews = $derived(Math.max(1, ...displayStats.campaigns.map((r) => r.views), 1));
	const maxCountryViews = $derived(Math.max(1, ...displayStats.countries.map((r) => r.views), 1));
	const maxEventViews = $derived(Math.max(1, ...displayStats.customEvents.map((r) => r.views), 1));
	const maxCityViews = $derived(Math.max(1, displayStats.cities[0]?.views ?? 1));

	// Scroll depth funnel — extract scroll_25/50/75/90 from customEvents.
	const scrollFunnel = $derived.by(() => {
		const find = (name: string) =>
			displayStats.customEvents.find((e) => e.label === name)?.views ?? 0;
		const pageviews = displayStats.pageviews;
		const steps = [
			{ label: 'Pageviews', count: pageviews },
			{ label: 'Scroll 25%', count: find('scroll_25') },
			{ label: 'Scroll 50%', count: find('scroll_50') },
			{ label: 'Scroll 75%', count: find('scroll_75') },
			{ label: 'Scroll 90%', count: find('scroll_90') }
		];
		const max = Math.max(1, pageviews);
		return steps.map((s, i) => ({
			...s,
			pct: (s.count / max) * 0.82,
			retention: i === 0 ? 1 : s.count / Math.max(1, steps[i - 1].count),
			dropoff: i === 0 ? 0 : 1 - s.count / Math.max(1, steps[i - 1].count),
			tip: i === 0
				? `${s.label} · ${s.count.toLocaleString()}`
				: `${s.label} · ${s.count.toLocaleString()} · ${Math.round((s.count / Math.max(1, steps[i - 1].count)) * 100)}% stayed`
		}));
	});

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

<!-- Hero-style live signal (full bleed) -->
<section class="console-panel" data-deck aria-label="Live analytics">
	<div class="pane-header">
		<span class="pane-title"><span class="pane-title-bar"></span> Live signal</span>
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
	<div class="p-4 sm:p-5">
		<p class="text-xs text-scifi-cyan mb-1 min-h-4 m-0">
			$ {kicker.replace(/^\/\/\s*/, '')} — {site.domain}
			{#if drillStats || drillLoading}
				<span class="text-scifi-primary"> ▸ {drillLabel || 'loading…'}</span>
			{:else}
				<span class="text-scifi-success"> ✓ last {days}d</span>
			{/if}
		</p>
		<h1
			class="hero-title text-2xl sm:text-3xl font-extrabold tracking-tight leading-none m-0 mb-4"
		>
			{site.name.toUpperCase()}
		</h1>

		{#if drillStats || drillLoading}
			<div class="drill-banner">
				<span class="badge badge-primary">{drillLoading ? 'loading…' : 'drill-down'}</span>
				<span class="text-sm text-scifi-muted ml-2 truncate">{drillLabel}</span>
				<button
					type="button"
					class="btn btn-xs btn-ghost ml-auto"
					onclick={clearDrill}
					disabled={drillLoading}
				>
					Clear ✕
				</button>
			</div>
		{/if}

		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
			<StatCard label="Pageviews" value={displayStats.pageviews} />
			<StatCard label="Visitors" value={displayStats.visitors} />
			<StatCard label="Bounce rate" value={displayStats.bounceRate} suffix="%" />
			<StatCard label="Pages / visit" value={displayStats.avgPagesPerVisit} />
			<StatCard label="Avg duration" value={formatDuration(displayStats.avgVisitDurationSec ?? 0)} />
		</div>

		<div class="glass rounded-lg p-2 mb-1 relative">
			<div class="pane-scan"></div>
			<div class="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
				<span class="text-[0.62rem] tracking-[0.18em] uppercase text-scifi-muted">
					Signal · {stats.timeseries.length} pts
				</span>
				<div class="flex flex-wrap items-center gap-3">
					{#if onChartChange}
						<div class="range-seg" role="group" aria-label="Chart type">
							<button
								type="button"
								class="range-btn {chart === 'line' ? 'is-active' : ''}"
								title="Sparkline"
								onclick={() => onChartChange('line')}
							>
								Line
							</button>
							<button
								type="button"
								class="range-btn {chart === 'bars' ? 'is-active' : ''}"
								title="Bars — visitors nested in pageviews"
								onclick={() => onChartChange('bars')}
							>
								Bars
							</button>
						</div>
					{/if}
					{#if onPointsChange}
						<div class="range-seg" role="group" aria-label="Chart resolution">
							{#each POINT_PRESETS as p}
								<button
									type="button"
									class="range-btn {points === p ? 'is-active' : ''}"
									title="About {p} data points"
									onclick={() => onPointsChange(p)}
								>
									{p}
								</button>
							{/each}
						</div>
					{/if}
					<span class="legend">
						<span class="legend-item">
							<span class="legend-swatch legend-pv {chart === 'bars' ? 'is-bar' : ''}"
							></span>
							pageviews
						</span>
						<span class="legend-item">
							<span class="legend-swatch legend-vis {chart === 'bars' ? 'is-bar' : ''}"
							></span>
							visitors
						</span>
					</span>
				</div>
			</div>
			<Sparkline
				data={stats.timeseries}
				variant={chart}
				showYAxis
				{onBarClick}
				{selectedBar}
			/>
		</div>
	</div>
</section>

<!-- Masonry deck -->
<div class="masonry" data-deck>
	<section class="console-panel masonry-item">
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
		<div class="p-4 sm:p-5">
			<ul class="space-y-1.5 text-xs m-0 p-0 list-none">
				{#each displayEvents.slice(0, 12) as e (e.id)}
					<li class="feed-row grid grid-cols-[4.5rem_1fr_auto] gap-2 items-baseline">
						<span class="text-scifi-muted tabular-nums">{relTime(e.created_at)}</span>
						<span class="truncate" title={e.path}>{streamLabel(e)}</span>
						<span class="text-scifi-cyan truncate max-w-32">{e.referrer ?? 'direct'}</span>
					</li>
				{:else}
					<li class="text-scifi-muted">{emptyStream}</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Top pages</span>
		</div>
		<div class="rank-body">
			{#each displayStats.topPages.slice(0, 8) as row, i}
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

	<section class="console-panel masonry-item masonry-wide">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Earth</span>
			<span class="text-scifi-muted text-[0.62rem] tracking-[0.12em] uppercase">
				{displayStats.cities.length} cities · {displayStats.countries.length} countries
			</span>
		</div>
		<div class="p-3 sm:p-4">
			<GeoGlobe cities={displayStats.cities} height={280} />
			<p class="text-scifi-muted text-[0.6rem] tracking-[0.1em] uppercase text-center mt-2 mb-0">
				Locations estimated from IP
			</p>
			<div class="geo-split mt-3">
				<div>
					<p class="label-kicker m-0 mb-2">Countries</p>
					{#each displayStats.countries.slice(0, 6) as row, i}
						<div class="rank-row">
							<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
							<div class="rank-main min-w-0">
								<div class="flex justify-between gap-2 text-xs mb-1">
									<span class="truncate">{countryName(row.label)}</span>
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
				<div>
					<p class="label-kicker m-0 mb-2">Cities</p>
					{#each displayStats.cities.slice(0, 6) as row, i}
						<div class="rank-row">
							<span class="rank-idx">{String(i + 1).padStart(2, '0')}</span>
							<div class="rank-main min-w-0">
								<div class="flex justify-between gap-2 text-xs mb-1">
									<span class="truncate">{row.city}</span>
									<span class="text-scifi-muted tabular-nums shrink-0"
										>{row.views.toLocaleString()}</span
									>
								</div>
								<div class="meter-track">
									<div
										class="meter-fill"
										style="width: {(row.views / maxCityViews) * 100}%"
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Referrers</span>
		</div>
		<div class="rank-body">
			{#each displayStats.topReferrers.slice(0, 8) as row, i}
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Campaigns</span>
		</div>
		<div class="rank-body space-y-4">
			<div>
				<p class="label-kicker m-0 mb-2">Sources</p>
				{#each displayStats.utmSources.slice(0, 5) as row}
					<div class="mb-2">
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
			<div>
				<p class="label-kicker m-0 mb-2">Mediums</p>
				{#each displayStats.utmMediums.slice(0, 5) as row}
					<div class="mb-2">
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
			<div>
				<p class="label-kicker m-0 mb-2">Campaigns</p>
				{#each displayStats.campaigns.slice(0, 5) as row}
					<div class="mb-2">
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Browsers</span>
		</div>
		<div class="rank-body">
			{#each displayStats.browsers.slice(0, 5) as row}
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> OS</span>
		</div>
		<div class="rank-body">
			{#each displayStats.operatingSystems.slice(0, 5) as row}
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Devices</span>
		</div>
		<div class="rank-body">
			{#each displayStats.devices.slice(0, 5) as row}
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Languages</span>
		</div>
		<div class="rank-body">
			{#each displayStats.languages.slice(0, 5) as row}
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

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Screens</span>
		</div>
		<div class="rank-body">
			{#each displayStats.screens.slice(0, 5) as row}
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

	<section class="console-panel masonry-item funnel-panel">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Scroll depth</span>
			<span class="text-scifi-muted text-[0.62rem] tracking-[0.12em] uppercase">
				{#if scrollFunnel[1]?.count}{Math.round((scrollFunnel[1].count / Math.max(1, scrollFunnel[0].count)) * 100)}% engaged{/if}
			</span>
		</div>
		<div class="funnel-body" data-deck>
			<div class="funnel-chart">
				{#each scrollFunnel as step, i}
					<div
						class="funnel-col tooltip tooltip-top"
						style="height: {step.pct * 100}%"
						data-tip={step.tip}
					>
						<span class="funnel-col-count tabular-nums">{step.count > 0 ? step.count.toLocaleString() : ''}</span>
						<div class="funnel-bar"></div>
						<span class="funnel-col-label">{step.label.replace('Scroll ', '').replace('Pageviews', 'PV')}</span>
					</div>
				{/each}
			</div>
			<div class="funnel-legend">
				{#each scrollFunnel as step, i}
					{#if i > 0 && step.dropoff > 0}
						<span class="funnel-legend-item">
							<span class="text-scifi-muted">↓{Math.round(step.dropoff * 100)}%</span>
							<span class="text-scifi-success/70">{Math.round(step.retention * 100)}%</span>
						</span>
					{:else}
						<span class="funnel-legend-item"></span>
					{/if}
				{/each}
			</div>
		</div>
	</section>

	<section class="console-panel masonry-item">
		<div class="pane-header">
			<span class="pane-title"><span class="pane-title-bar"></span> Events</span>
		</div>
		<div class="rank-body">
			<p class="text-scifi-muted text-[0.65rem] m-0 mb-2 tracking-wide">
				Auto + <code class="text-scifi-cyan">statsman.track('name')</code>
			</p>
			{#each displayStats.customEvents.slice(0, 8) as row, i}
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
				<p class="text-scifi-muted text-xs m-0">
					No events yet — install the tracker or fire <code class="text-scifi-cyan">statsman.track()</code>.
				</p>
			{/each}
		</div>
	</section>
</div>

<style>
	.drill-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.85rem;
		margin-bottom: 0.85rem;
		border-radius: 10px;
		border: 1px solid rgba(var(--scifi-primary-rgb), 0.4);
		background: rgba(var(--scifi-primary-rgb), 0.08);
	}

	.masonry {
		columns: 1;
		column-gap: 1rem;
		margin-top: 1rem;
	}
	@media (min-width: 720px) {
		.masonry {
			columns: 2;
		}
	}
	@media (min-width: 1100px) {
		.masonry {
			columns: 3;
		}
	}

	.masonry-item {
		break-inside: avoid;
		-webkit-column-break-inside: avoid;
		page-break-inside: avoid;
		margin-bottom: 1rem;
		display: inline-block;
		width: 100%;
		vertical-align: top;
	}

	/* Prefer native CSS masonry when available */
	@supports (grid-template-rows: masonry) {
		.masonry {
			display: grid;
			grid-template-columns: 1fr;
			grid-template-rows: masonry;
			gap: 1rem;
			columns: unset;
		}
		@media (min-width: 720px) {
			.masonry {
				grid-template-columns: 1fr 1fr;
			}
		}
		@media (min-width: 1100px) {
			.masonry {
				grid-template-columns: 1fr 1fr 1fr;
			}
		}
		.masonry-item {
			display: block;
			margin-bottom: 0;
			break-inside: unset;
		}
		.masonry-wide {
			grid-column: span 2;
		}
		@media (max-width: 1099px) {
			.masonry-wide {
				grid-column: span 1;
			}
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
	.legend-swatch {
		width: 0.7rem;
		height: 2px;
		border-radius: 999px;
		display: inline-block;
	}
	.legend-swatch.is-bar {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 2px;
	}
	.legend-pv {
		background: var(--scifi-primary);
		box-shadow: 0 0 6px var(--scifi-primary-glow);
	}
	.legend-vis {
		background: var(--scifi-cyan);
		box-shadow: 0 0 6px var(--scifi-cyan-glow);
	}

	.geo-split {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: 1fr 1fr;
	}
	@media (max-width: 520px) {
		.geo-split {
			grid-template-columns: 1fr;
		}
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

	.funnel-body {
		padding: 0.75rem 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.funnel-panel {
		overflow: visible;
	}
	.funnel-panel .funnel-col::after {
		z-index: 200;
		background: rgb(var(--scifi-surface-1-rgb));
	}
	.funnel-chart {
		display: flex;
		align-items: flex-end;
		justify-content: stretch;
		gap: 0.4rem;
		height: 140px;
	}
	.funnel-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0.2rem;
		min-width: 0;
		overflow: visible;
	}
	.funnel-col-count {
		font-size: 0.58rem;
		color: var(--scifi-muted);
		line-height: 1;
		white-space: nowrap;
	}
	.funnel-bar {
		width: 100%;
		border-radius: 3px 3px 0 0;
		background: linear-gradient(180deg, var(--scifi-cyan), var(--scifi-primary));
		box-shadow: 0 0 10px var(--scifi-primary-glow);
		min-height: 2px;
		flex: 1;
		transition: height 0.7s var(--scifi-ease, ease-out);
	}
	.funnel-col-label {
		font-size: 0.55rem;
		letter-spacing: 0.04em;
		color: var(--scifi-muted);
		white-space: nowrap;
		line-height: 1;
	}
	.funnel-legend {
		display: flex;
		justify-content: stretch;
		gap: 0.4rem;
	}
	.funnel-legend-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		font-size: 0.55rem;
		letter-spacing: 0.02em;
		min-width: 0;
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
	.feed-row:first-child {
		animation: feed-in 0.45s var(--scifi-ease, ease-out);
	}

	@media (prefers-reduced-motion: reduce) {
		.feed-row:first-child {
			animation: none;
		}
	}
</style>
