/** ISO 3166-1 alpha-2 → English display name (e.g. LB → Lebanon). */
const regionNames =
	typeof Intl !== 'undefined' && 'DisplayNames' in Intl
		? new Intl.DisplayNames(['en'], { type: 'region' })
		: null;

export function countryName(code: string | null | undefined): string {
	if (!code) return 'Unknown';
	const c = code.trim().toUpperCase();
	if (c === 'UNKNOWN' || c === '?' || c.length !== 2) return code;
	try {
		return regionNames?.of(c) ?? code;
	} catch {
		return code;
	}
}
