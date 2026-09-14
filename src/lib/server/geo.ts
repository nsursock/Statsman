import type { GeoLookup } from './geo-types';

export type { GeoLookup } from './geo-types';

function isNonPublicIp(ip: string): boolean {
	const v = ip.replace(/^::ffff:/, '').toLowerCase();
	if (!v || v === '127.0.0.1' || v === '::1' || v === '0.0.0.0') return true;
	if (v.startsWith('10.') || v.startsWith('192.168.') || v.startsWith('169.254.')) return true;
	if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
	if (v.startsWith('fdaa:') || v.startsWith('fc') || v.startsWith('fd')) return true;
	return false;
}

/**
 * Resolve the client IP, tolerating `getClientAddress()` throwing in dev (no
 * proxy adapter to supply one). Header candidates are still tried first; the
 * getter only matters when no proxy header is present.
 */
export function safeClientIp(request: Request, getter: () => string): string {
	let fallback = '';
	try {
		fallback = getter();
	} catch {
		/* dev: getClientAddress unavailable — fall back to headers only */
	}
	return resolveClientIp(request, fallback);
}

/**
 * Prefer proxy client IP headers — set ADDRESS_HEADER on the platform when needed.
 */
export function resolveClientIp(request: Request, fallback: string): string {
	const candidates = [
		request.headers.get('fly-client-ip'),
		request.headers.get('cf-connecting-ip'),
		request.headers.get('true-client-ip'),
		request.headers.get('x-real-ip'),
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
		fallback
	];
	for (const raw of candidates) {
		if (!raw) continue;
		const ip = raw.replace(/^::ffff:/, '').trim();
		if (ip && !isNonPublicIp(ip)) return ip;
	}
	return fallback.replace(/^::ffff:/, '').trim();
}

/** Resolve country/city from IP. Never persist the IP — only these fields. */
export function lookupGeo(ip: string | null | undefined): GeoLookup {
	if (!ip) return { country: null, city: null, lat: null, lng: null };
	const cleaned = ip.replace(/^::ffff:/, '').trim();
	if (isNonPublicIp(cleaned)) {
		return { country: null, city: null, lat: null, lng: null };
	}
	try {
		// Lazy-load: geoip-lite data files are large; don't pay at process boot.
		const geoip = require('geoip-lite') as typeof import('geoip-lite');
		const hit = geoip.lookup(cleaned);
		if (!hit) return { country: null, city: null, lat: null, lng: null };
		const [lat, lng] = hit.ll ?? [];
		return {
			country: hit.country ? String(hit.country).slice(0, 2).toUpperCase() : null,
			city: hit.city ? String(hit.city).slice(0, 80) : null,
			lat: typeof lat === 'number' && Number.isFinite(lat) ? Math.round(lat * 1000) / 1000 : null,
			lng: typeof lng === 'number' && Number.isFinite(lng) ? Math.round(lng * 1000) / 1000 : null
		};
	} catch {
		return { country: null, city: null, lat: null, lng: null };
	}
}

function parseCoord(val: string | null): number | null {
	if (!val) return null;
	const n = parseFloat(val);
	return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function parseCityHeader(val: string | null): string | null {
	if (!val) return null;
	try {
		val = decodeURIComponent(val);
	} catch {
		/* invalid url-encoding, keep raw */
	}
	const trimmed = val.trim();
	return trimmed ? trimmed.slice(0, 80) : null;
}

/** Prefer Cloudflare / proxy hints when geoip misses (still no raw IP stored). */
export function geoFromHeaders(request: Request, ip: string): GeoLookup {
	const fromIp = lookupGeo(ip);

	const cfCountry = request.headers.get('cf-ipcountry');
	const validCfCountry =
		cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1'
			? cfCountry.slice(0, 2).toUpperCase()
			: null;

	const country = fromIp.country ?? validCfCountry;
	const city = fromIp.city ?? parseCityHeader(request.headers.get('cf-ipcity'));
	const lat = fromIp.lat ?? parseCoord(request.headers.get('cf-iplatitude'));
	const lng = fromIp.lng ?? parseCoord(request.headers.get('cf-iplongitude'));

	return { country, city, lat, lng };
}
