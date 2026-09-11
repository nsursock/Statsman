import geoip from 'geoip-lite';

export type GeoLookup = {
	country: string | null;
	city: string | null;
	/** WGS84 degrees; null when unknown */
	lat: number | null;
	lng: number | null;
};

/** Resolve country/city from IP. Never persist the IP — only these fields. */
export function lookupGeo(ip: string | null | undefined): GeoLookup {
	if (!ip) return { country: null, city: null, lat: null, lng: null };
	const cleaned = ip.replace(/^::ffff:/, '').trim();
	if (!cleaned || cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === '0.0.0.0') {
		// Localhost — treat as unknown (demo seed supplies coords explicitly).
		return { country: null, city: null, lat: null, lng: null };
	}
	try {
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

/** Prefer Cloudflare / proxy country hint when geoip misses (still no raw IP stored). */
export function geoFromHeaders(request: Request, ip: string): GeoLookup {
	const fromIp = lookupGeo(ip);
	const cf = request.headers.get('cf-ipcountry');
	if (fromIp.country) return fromIp;
	if (cf && cf !== 'XX' && cf !== 'T1') {
		return { country: cf.slice(0, 2).toUpperCase(), city: null, lat: null, lng: null };
	}
	return fromIp;
}
