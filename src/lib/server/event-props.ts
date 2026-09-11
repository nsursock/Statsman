/** Sanitize optional custom-event props for storage (JSON string, capped). */
export function serializeEventProps(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw !== 'object' || Array.isArray(raw)) return null;
	const entries = Object.entries(raw as Record<string, unknown>).slice(0, 20);
	const out: Record<string, string | number | boolean | null> = {};
	for (const [k, v] of entries) {
		const key = String(k).slice(0, 40);
		if (typeof v === 'string') out[key] = v.slice(0, 200);
		else if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.round(v * 1000) / 1000;
		else if (typeof v === 'boolean' || v === null) out[key] = v;
		else out[key] = String(v).slice(0, 200);
	}
	const json = JSON.stringify(out);
	if (json === '{}') return null;
	return json.slice(0, 1000);
}

export function parseDurationMs(raw: unknown): number | null {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n) || n < 0) return null;
	return Math.min(Math.round(n), 1000 * 60 * 60 * 6); // cap 6h
}
