/**
 * Live-signal timeseries bucketing.
 * Pick a nice interval so the series has roughly `targetPoints` samples.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Nice intervals (ms) — snapped so charts stay readable. */
const NICE_INTERVALS = [
	1 * MINUTE,
	5 * MINUTE,
	10 * MINUTE,
	15 * MINUTE,
	30 * MINUTE,
	1 * HOUR,
	2 * HOUR,
	4 * HOUR,
	6 * HOUR,
	12 * HOUR,
	1 * DAY,
	2 * DAY,
	7 * DAY
] as const;

export const POINT_PRESETS = [48, 96, 192] as const;
export type PointPreset = (typeof POINT_PRESETS)[number];
export const DEFAULT_POINTS = 96;
export const MIN_POINTS = 24;
export const MAX_POINTS = 360;

export const CHART_TYPES = ['line', 'bars'] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const DEFAULT_CHART: ChartType = 'line';

export function clampPoints(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_POINTS;
	return Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(value)));
}

export function parsePointsParam(raw: string | null | undefined): number {
	if (raw == null || raw === '') return DEFAULT_POINTS;
	return clampPoints(Number(raw));
}

export function parseChartParam(raw: string | null | undefined): ChartType {
	if (raw === 'bars' || raw === 'bar') return 'bars';
	if (raw === 'line' || raw === 'sparkline') return 'line';
	return DEFAULT_CHART;
}

/** Choose the nice interval whose resulting sample count is closest to `targetPoints`. */
export function bucketMsForTarget(days: number, targetPoints = DEFAULT_POINTS): number {
	const rangeMs = Math.max(days, 1) * DAY;
	const target = clampPoints(targetPoints);
	let best = NICE_INTERVALS[NICE_INTERVALS.length - 1];
	let bestScore = Infinity;

	for (const iv of NICE_INTERVALS) {
		const n = Math.floor(rangeMs / iv) + 1;
		if (n < 8 || n > MAX_POINTS + 40) continue;
		const score = Math.abs(n - target);
		// Prefer denser when tied (smoother curve).
		if (score < bestScore || (score === bestScore && iv < best)) {
			best = iv;
			bestScore = score;
		}
	}
	return best;
}

/** @deprecated Prefer bucketMsForTarget — kept for call-site clarity. */
export function bucketMsForRange(days: number, targetPoints = DEFAULT_POINTS): number {
	return bucketMsForTarget(days, targetPoints);
}

export function alignFloor(ts: number, bucketMs: number): number {
	return Math.floor(ts / bucketMs) * bucketMs;
}

export type RawBucket = {
	bucket: number | string | bigint;
	pageviews: number | string;
	visitors: number | string;
};

export function fillTimeseries(
	days: number,
	raw: RawBucket[],
	targetPoints = DEFAULT_POINTS,
	now = Date.now()
): { date: string; pageviews: number; visitors: number }[] {
	const bucketMs = bucketMsForTarget(days, targetPoints);
	const since = now - days * DAY;
	const start = alignFloor(since, bucketMs);
	const end = alignFloor(now, bucketMs);

	const map = new Map<number, { pageviews: number; visitors: number }>();
	for (const row of raw) {
		map.set(Number(row.bucket), {
			pageviews: Number(row.pageviews),
			visitors: Number(row.visitors)
		});
	}

	const timeseries: { date: string; pageviews: number; visitors: number }[] = [];
	for (let t = start; t <= end; t += bucketMs) {
		const hit = map.get(t);
		timeseries.push({
			date: new Date(t).toISOString(),
			pageviews: hit?.pageviews ?? 0,
			visitors: hit?.visitors ?? 0
		});
	}
	return timeseries;
}
