/** Hostname / IP helpers for traffic exclusions (never persist visitor IPs in events). */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function isDevHostname(host: string | null | undefined): boolean {
	if (!host) return false;
	const h = host.trim().toLowerCase().replace(/:\d+$/, '');
	if (!h) return false;
	if (LOCAL_HOSTS.has(h)) return true;
	if (h.endsWith('.local')) return true;
	return false;
}

export function normalizeIp(ip: string | null | undefined): string | null {
	if (!ip) return null;
	const cleaned = ip.replace(/^::ffff:/i, '').trim().toLowerCase();
	return cleaned || null;
}

export function parseExcludedIps(raw: string | null | undefined): string[] {
	if (!raw) return [];
	const trimmed = raw.trim();
	if (!trimmed) return [];
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (!Array.isArray(parsed)) return [];
		return [
			...new Set(
				parsed
					.map((v) => normalizeIp(String(v)))
					.filter((v): v is string => Boolean(v))
			)
		];
	} catch {
		// Allow newline / comma-separated lists from older clients
		return [
			...new Set(
				trimmed
					.split(/[\s,]+/)
					.map((v) => normalizeIp(v))
					.filter((v): v is string => Boolean(v))
			)
		];
	}
}

export function serializeExcludedIps(ips: string[]): string {
	const unique = [
		...new Set(ips.map((v) => normalizeIp(v)).filter((v): v is string => Boolean(v)))
	];
	return JSON.stringify(unique);
}

export function ipIsExcluded(clientIp: string, excludedRaw: string | null | undefined): boolean {
	const ip = normalizeIp(clientIp);
	if (!ip) return false;
	const list = parseExcludedIps(excludedRaw);
	return list.includes(ip);
}

export function siteIgnoresLocalhost(site: { ignore_localhost?: boolean | number | null }): boolean {
	const v = site.ignore_localhost;
	if (v === false || v === 0) return false;
	return true;
}
