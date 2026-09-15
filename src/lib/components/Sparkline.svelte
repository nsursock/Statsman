<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from '@scifiui/core/js';
	import type { ChartType } from '$lib/timeseries';

	export type BarRange = { index: number; start: number; end: number; date: string };

	let {
		data,
		variant = 'line',
		showYAxis = false,
		onBarClick,
		selectedBar = -1
	}: {
		data: { date: string; pageviews: number; visitors: number }[];
		variant?: ChartType;
		showYAxis?: boolean;
		onBarClick?: (range: BarRange) => void;
		selectedBar?: number;
	} = $props();

	let svg: SVGSVGElement;
	const gid = $props.id();
	const max = $derived(Math.max(1, ...data.map((d) => d.pageviews)));
	let hoveredBar = $state(-1);
	const w = 640;
	const h = 200;
	const padRight = 12;
	const padLeft = $derived(showYAxis ? 38 : 12);
	const padTop = 10;
	const padBottom = 28;
	const plotH = h - padTop - padBottom;
	const plotW = $derived(w - padLeft - padRight);

	const parsed = $derived(
		data.map((d) => {
			const t = Date.parse(d.date);
			return { ...d, t: Number.isFinite(t) ? t : NaN };
		})
	);
	const hasDates = $derived(parsed.some((d) => Number.isFinite(d.t)));
	const spanMs = $derived.by(() => {
		const times = parsed.map((d) => d.t).filter((t) => Number.isFinite(t));
		if (times.length < 2) return 0;
		return Math.max(...times) - Math.min(...times);
	});
	// Width of one bucket in ms — used to compute a bar's [start, end) window.
	const bucketMs = $derived.by(() => {
		const times = parsed.map((d) => d.t).filter((t) => Number.isFinite(t));
		if (times.length < 2) return 0;
		const sorted = [...times].sort((a, b) => a - b);
		return sorted[1] - sorted[0];
	});

	function xAt(i: number): number {
		return padLeft + (i / Math.max(data.length - 1, 1)) * plotW;
	}

	function yAt(value: number): number {
		return padTop + plotH - (value / max) * plotH;
	}

	const toPoints = (key: 'pageviews' | 'visitors') =>
		data.map((d, i) => `${xAt(i)},${yAt(d[key])}`).join(' ');

	const linePoints = $derived(toPoints('pageviews'));
	const visitorPoints = $derived(toPoints('visitors'));

	const bars = $derived.by(() => {
		const n = Math.max(data.length, 1);
		const slot = plotW / n;
		const gap = n > 120 ? 0.12 : n > 60 ? 0.18 : 0.28;
		const outerW = Math.max(1.2, slot * (1 - gap));
		const innerW = Math.max(0.8, outerW * 0.55);
		return data.map((d, i) => {
			const cx = padLeft + i * slot + slot / 2;
			const pv = Math.max(0, d.pageviews);
			const vis = Math.max(0, Math.min(d.visitors, pv));
			const pvH = (pv / max) * plotH;
			const visH = (vis / max) * plotH;
			return {
				i,
				outer: {
					x: cx - outerW / 2,
					y: padTop + plotH - pvH,
					w: outerW,
					h: pvH
				},
				inner: {
					x: cx - innerW / 2,
					y: padTop + plotH - visH,
					w: innerW,
					h: visH
				}
			};
		});
	});

	const ticks = $derived.by(() => {
		if (!hasDates || data.length === 0) return [] as { x: number; label: string }[];
		const count = Math.min(6, Math.max(2, data.length));
		const span = spanMs;
		const out: { x: number; label: string }[] = [];
		for (let i = 0; i < count; i++) {
			const idx = count === 1 ? 0 : Math.round((i / (count - 1)) * (data.length - 1));
			const row = parsed[idx];
			if (!row || !Number.isFinite(row.t)) continue;
			const x =
				variant === 'bars'
					? padLeft + (idx + 0.5) * (plotW / Math.max(data.length, 1))
					: xAt(idx);
			out.push({ x, label: formatTick(row.t, span) });
		}
		return out.filter((t, i, arr) => i === 0 || t.label !== arr[i - 1].label);
	});

	// Y-axis tick rows: 0, ¼, ½, ¾, max (rounded to a nice number).
	const yTicks = $derived.by(() => {
		if (!showYAxis) return [] as { y: number; label: string }[];
		const steps = 4;
		const out: { y: number; label: string }[] = [];
		for (let i = 0; i <= steps; i++) {
			const value = (max * i) / steps;
			out.push({ y: yAt(value), label: formatY(value) });
		}
		return out;
	});

	function formatY(n: number): string {
		if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
		return Math.round(n).toString();
	}

	function formatTick(ts: number, span: number): string {
		const d = new Date(ts);
		const day = 24 * 60 * 60 * 1000;
		if (span <= 2 * day) {
			return d.toLocaleTimeString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			});
		}
		if (span <= 14 * day) {
			return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
		}
		return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
	}

	function barRange(i: number): BarRange {
		const row = parsed[i];
		const start = Number.isFinite(row?.t) ? row.t : Date.parse(data[i].date);
		const end = bucketMs > 0 ? start + bucketMs : start + 1;
		return { index: i, start, end, date: data[i].date };
	}

	// Tooltip for the hovered bar — SVG-native since CSS ::after doesn't work on SVG.
	const tooltip = $derived.by(() => {
		if (hoveredBar < 0 || hoveredBar >= data.length) return null;
		const bar = bars[hoveredBar];
		const row = data[hoveredBar];
		if (!bar || !row) return null;
		const cx = bar.outer.x + bar.outer.w / 2;
		const lines = [
			formatTick(Number.isFinite(parsed[hoveredBar]?.t) ? parsed[hoveredBar].t : Date.parse(row.date), spanMs),
			`${row.pageviews.toLocaleString()} pageviews`,
			`${row.visitors.toLocaleString()} visitors`
		];
		const tw = 112;
		const th = lines.length * 9.5 + 6;
		const tx = Math.max(padLeft, Math.min(w - padRight - tw, cx - tw / 2));
		const ty = Math.max(padTop, bar.outer.y - th - 4);
		return { tx, ty, tw, th, lines };
	});

	onMount(() => {
		if (variant === 'bars') {
			const rects = svg.querySelectorAll('.bar-grow');
			rects.forEach((rect, i) => {
				const el = rect as SVGRectElement;
				const height = Number(el.getAttribute('height') || 0);
				const y = Number(el.getAttribute('y') || 0);
				if (height <= 0) return;
				gsap.fromTo(
					el,
					{ attr: { height: 0, y: y + height } },
					{
						attr: { height, y },
						duration: 0.65,
						delay: Math.min(i * 0.008, 0.5),
						ease: 'power3.out'
					}
				);
			});
			return;
		}
		const lines = svg.querySelectorAll('.line');
		for (const line of lines) {
			if ('getTotalLength' in line) {
				const length = (line as SVGGeometryElement).getTotalLength();
				gsap.fromTo(
					line,
					{ strokeDasharray: length, strokeDashoffset: length },
					{ strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }
				);
			}
		}
		const area = svg.querySelector('.area');
		if (area) {
			gsap.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.4 });
		}
	});
</script>

<svg
	bind:this={svg}
	viewBox="0 0 {w} {h}"
	class="chart w-full h-auto block"
	role="img"
	aria-label={variant === 'bars'
		? 'Pageviews bars with nested visitors'
		: 'Pageviews and visitors over time'}
>
	<defs>
		<linearGradient id="{gid}-fill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--scifi-primary)" stop-opacity="0.35" />
			<stop offset="100%" stop-color="var(--scifi-primary)" stop-opacity="0" />
		</linearGradient>
		<linearGradient id="{gid}-bar-pv" x1="0" y1="1" x2="0" y2="0">
			<stop offset="0%" stop-color="var(--scifi-primary)" stop-opacity="0.35" />
			<stop offset="100%" stop-color="var(--scifi-primary)" stop-opacity="0.85" />
		</linearGradient>
		<linearGradient id="{gid}-bar-vis" x1="0" y1="1" x2="0" y2="0">
			<stop offset="0%" stop-color="var(--scifi-cyan)" stop-opacity="0.45" />
			<stop offset="100%" stop-color="var(--scifi-cyan)" stop-opacity="0.95" />
		</linearGradient>
	</defs>

	<line
		x1={padLeft}
		y1={padTop + plotH}
		x2={w - padRight}
		y2={padTop + plotH}
		stroke="var(--scifi-border)"
		stroke-width="1"
		opacity="0.7"
	/>

	{#if showYAxis}
		<line
			x1={padLeft}
			y1={padTop}
			x2={padLeft}
			y2={padTop + plotH}
			stroke="var(--scifi-border)"
			stroke-width="1"
			opacity="0.5"
		/>
		{#each yTicks as tick (tick.label + tick.y)}
			<line
				x1={padLeft}
				y1={tick.y}
				x2={w - padRight}
				y2={tick.y}
				stroke="var(--scifi-border)"
				stroke-width="1"
				opacity="0.18"
			/>
			<text
				x={padLeft - 6}
				y={tick.y + 3}
				text-anchor="end"
				fill="var(--scifi-muted)"
				font-size="9"
				font-family="var(--scifi-font-mono, ui-monospace, monospace)"
				letter-spacing="0.04em"
			>
				{tick.label}
			</text>
		{/each}
	{/if}

	{#if variant === 'bars'}
		{#each bars as bar (bar.i)}
			{#if bar.outer.h > 0}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<rect
					class="bar-grow"
					x={bar.outer.x}
					y={bar.outer.y}
					width={bar.outer.w}
					height={bar.outer.h}
					rx={Math.min(2, bar.outer.w / 2)}
					fill="url(#{gid}-bar-pv)"
					opacity={selectedBar === -1 || selectedBar === bar.i ? 1 : 0.3}
					style={onBarClick ? 'cursor: pointer;' : ''}
					onclick={onBarClick ? () => onBarClick(barRange(bar.i)) : undefined}
					onmouseenter={() => (hoveredBar = bar.i)}
					onmouseleave={() => (hoveredBar = -1)}
				/>
			{/if}
			{#if bar.inner.h > 0}
				<rect
					class="bar-grow"
					x={bar.inner.x}
					y={bar.inner.y}
					width={bar.inner.w}
					height={bar.inner.h}
					rx={Math.min(1.5, bar.inner.w / 2)}
					fill="url(#{gid}-bar-vis)"
					opacity={selectedBar === -1 || selectedBar === bar.i ? 1 : 0.3}
					style="pointer-events: none;"
				/>
			{/if}
		{/each}

		{#if tooltip}
			<g style="pointer-events: none;">
				<rect
					x={tooltip.tx}
					y={tooltip.ty}
					width={tooltip.tw}
					height={tooltip.th}
					rx="3"
					fill="rgba(var(--scifi-surface-1-rgb), 0.96)"
					stroke="var(--scifi-border)"
					stroke-width="1"
				/>
				{#each tooltip.lines as line, i}
					<text
						x={tooltip.tx + 6}
						y={tooltip.ty + 9 + i * 9.5}
						fill={i === 0 ? 'var(--scifi-cyan)' : 'var(--scifi-text)'}
						font-size="7"
						font-family="var(--scifi-font-mono, ui-monospace, monospace)"
						letter-spacing="0.03em"
					>
						{line}
					</text>
				{/each}
			</g>
		{/if}
	{:else}
		<polyline
			class="area"
			fill="url(#{gid}-fill)"
			stroke="none"
			points={`${padLeft},${padTop + plotH} ${linePoints} ${w - padRight},${padTop + plotH}`}
		/>
		<polyline
			class="line"
			fill="none"
			stroke="var(--scifi-cyan)"
			stroke-width="1.5"
			stroke-opacity="0.85"
			stroke-linejoin="round"
			stroke-linecap="round"
			points={visitorPoints}
		/>
		<polyline
			class="line"
			fill="none"
			stroke="var(--scifi-primary)"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
			points={linePoints}
		/>
	{/if}

	{#each ticks as tick (tick.x + tick.label)}
		<line
			x1={tick.x}
			y1={padTop + plotH}
			x2={tick.x}
			y2={padTop + plotH + 4}
			stroke="var(--scifi-muted)"
			stroke-width="1"
			opacity="0.55"
		/>
		<text
			x={tick.x}
			y={h - 8}
			text-anchor="middle"
			fill="var(--scifi-muted)"
			font-size="9"
			font-family="var(--scifi-font-mono, ui-monospace, monospace)"
			letter-spacing="0.04em"
		>
			{tick.label}
		</text>
	{/each}
</svg>
