import { env } from '$env/dynamic/private';
import Database from 'better-sqlite3';
import type { GeoLookup } from './geo-types';
import type { CityResponse } from 'maxmind';

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

function parseCoord(val: string | null): number | null {
	if (!val) return null;
	const n = parseFloat(val);
	return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

/* --------------------- reverse geocoding (standard method) --------------------- */
/**
 * The city name is ALWAYS derived from the coordinates via a local reverse
 * geocoder — not from cf-ipcity or the MMDB city field. This guarantees the
 * pin's label matches its plotted location (the root cause of the
 * "Hong Kong · Russia" bug was a city from one source mismatched with coords
 * from another).
 *
 * Uses a bundled worldcities.db (simplemaps basic data, ~41k cities, 6MB)
 * queried via better-sqlite3 (already a project dependency). Nearest-city
 * lookup by bounding-box + squared-distance sort — sub-millisecond, no
 * network. If the DB is absent (dev without the file), falls back to whatever
 * city the source (CF/MMDB) provided.
 */
const CITIES_DB_PATH =
	env.STATSMAN_CITIES_DB_PATH || env.CITIES_DB_PATH || './data/worldcities.db';

let citiesDb: Database.Database | null | undefined;

function getCitiesDb(): Database.Database | null {
	if (citiesDb !== undefined) return citiesDb;
	try {
		// Opened read-only — the lat/lng index is baked in ahead of time by
		// scripts/fetch-cities.sh (the file may be read-only in containers).
		citiesDb = new Database(CITIES_DB_PATH, { readonly: true, fileMustExist: true });
	} catch {
		/* DB file missing — reverse geocoder disabled, fall back to source city. */
		citiesDb = null;
	}
	return citiesDb;
}

/** Nearest-city SQL — bounding box ±1°, sorted by squared Euclidean distance. */
const NEAREST_CITY_SQL = `
	SELECT cc.city, co.iso2
	FROM worldcities w
	JOIN worldcities_city cc ON w.city = cc.id
	JOIN worldcities_country co ON w.country = co.id
	WHERE w.latitude BETWEEN ? AND ?
	  AND w.longitude BETWEEN ? AND ?
	ORDER BY (w.latitude - ?) * (w.latitude - ?) + (w.longitude - ?) * (w.longitude - ?)
	LIMIT 1`;

/**
 * Reverse-geocode coordinates to the nearest city name + country code.
 * Returns null if the DB is unavailable or no city is within range.
 */
function reverseGeocode(lat: number, lng: number): { city: string; country: string } | null {
	const db = getCitiesDb();
	if (!db) return null;
	// Search within ±1° (~111km). If nothing found, expand to ±5°.
	for (const range of [1, 5, 30]) {
		const row = db
			.prepare(NEAREST_CITY_SQL)
			.get(lat - range, lat + range, lng - range, lng + range, lat, lat, lng, lng) as
			| { city: string; iso2: string }
			| undefined;
		if (row?.city) {
			return { city: row.city.slice(0, 80), country: row.iso2.toUpperCase() };
		}
	}
	return null;
}

/* ----------------------------- MMDB fallback ----------------------------- */
/**
 * Local GeoIP fallback for the small fraction of traffic that reaches the app
 * directly (bypassing Cloudflare, so cf-ip* headers are absent). Uses DB-IP's
 * free "City Lite" MMDB (CC BY 4.0, no license key, updated monthly) read via
 * the `maxmind` package. Bake the DB into the image with scripts/fetch-geodb.sh
 * (the Dockerfile does this at build time).
 *
 * Lazy-loaded: the ~60MB MMDB is only memory-mapped on the first fallback
 * lookup. If the file is absent (dev without the DB), lookups return nulls —
 * the dashboard simply shows fewer pins rather than wrong ones.
 */
const GEODB_PATH =
	env.STATSMAN_GEODB_PATH || env.GEODB_PATH || './data/dbip-city-lite.mmdb';

let readerPromise: Promise<import('maxmind').Reader<CityResponse> | null> | null = null;

async function getReader(): Promise<import('maxmind').Reader<CityResponse> | null> {
	if (readerPromise) return readerPromise;
	readerPromise = (async () => {
		try {
			const maxmind = (await import('maxmind')).default;
			return await maxmind.open<CityResponse>(GEODB_PATH, { cache: { max: 4096 } });
		} catch {
			/* DB file missing or unreadable — fallback disabled. */
			return null;
		}
	})();
	return readerPromise;
}

/** Resolve country + coordinates from a local MMDB. Never persist the IP. */
async function lookupGeoMmdb(ip: string): Promise<GeoLookup> {
	const cleaned = ip.replace(/^::ffff:/, '').trim();
	if (!cleaned || isNonPublicIp(cleaned)) {
		return { country: null, city: null, lat: null, lng: null };
	}
	const reader = await getReader();
	if (!reader) return { country: null, city: null, lat: null, lng: null };
	const hit = reader.get(cleaned) as CityResponse | null;
	if (!hit) return { country: null, city: null, lat: null, lng: null };
	const country = hit.country?.iso_code ? hit.country.iso_code.slice(0, 2).toUpperCase() : null;
	const lat =
		typeof hit.location?.latitude === 'number' && Number.isFinite(hit.location.latitude)
			? Math.round(hit.location.latitude * 1000) / 1000
			: null;
	const lng =
		typeof hit.location?.longitude === 'number' && Number.isFinite(hit.location.longitude)
			? Math.round(hit.location.longitude * 1000) / 1000
			: null;
	// City from MMDB is used only as a fallback when the reverse geocoder DB
	// is unavailable. When the reverse geocoder is present, it overrides this.
	const mmdbCity = hit.city?.names?.en ? hit.city.names.en.slice(0, 80) : null;
	return { country, city: mmdbCity, lat, lng };
}

/**
 * Resolve geo for an incoming event.
 *
 * Flow:
 *  1. Get coordinates + country from Cloudflare headers (prod is always behind
 *     CF) or, when CF headers are absent (direct hits), from the local MMDB.
 *  2. Derive the city name from the coordinates via the local reverse geocoder
 *     (worldcities.db). This is the STANDARD method — the city always matches
 *     the pin location, making a "Hong Kong · Russia" mismatch impossible.
 *  3. If the reverse geocoder DB is unavailable (dev without the file), fall
 *     back to whatever city the source (CF/MMDB) provided.
 *
 * Country comes from the same source as the coordinates. Never persist the
 * raw IP — only these derived fields.
 */
export async function geoFromHeaders(request: Request, ip: string): Promise<GeoLookup> {
	const cfCountry = request.headers.get('cf-ipcountry');
	const validCfCountry =
		cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1'
			? cfCountry.slice(0, 2).toUpperCase()
			: null;
	const cfLat = parseCoord(request.headers.get('cf-iplatitude'));
	const cfLng = parseCoord(request.headers.get('cf-iplongitude'));

	// Cloudflare present with coordinates — use CF coords + country.
	if (cfLat != null && cfLng != null) {
		const rev = reverseGeocode(cfLat, cfLng);
		return {
			country: rev?.country ?? validCfCountry,
			city: rev?.city ?? null,
			lat: cfLat,
			lng: cfLng
		};
	}

	// No CF coords — fall back to MMDB (direct hits bypassing Cloudflare).
	const fromMmdb = ip ? await lookupGeoMmdb(ip) : { country: null, city: null, lat: null, lng: null };
	if (fromMmdb.lat != null && fromMmdb.lng != null) {
		const rev = reverseGeocode(fromMmdb.lat, fromMmdb.lng);
		return {
			country: rev?.country ?? fromMmdb.country ?? validCfCountry,
			city: rev?.city ?? fromMmdb.city,
			lat: fromMmdb.lat,
			lng: fromMmdb.lng
		};
	}

	// No coordinates from any source — no pin possible.
	return { country: validCfCountry ?? fromMmdb.country, city: null, lat: null, lng: null };
}
