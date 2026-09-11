/** Normalize a stored domain or Origin/Referer host for allowlist checks. */
export function normalizeHost(input: string | null | undefined): string | null {
	if (!input) return null;
	let value = input.trim().toLowerCase();
	if (!value) return null;

	try {
		if (value.includes('://')) {
			value = new URL(value).hostname;
		} else if (value.includes('/') && !value.includes(' ')) {
			value = new URL(`http://${value}`).hostname;
		}
	} catch {
		value = value.replace(/^https?:\/\//, '').split('/')[0] ?? value;
	}

	value = value.replace(/:\d+$/, '');
	if (value.startsWith('www.')) value = value.slice(4);
	return value || null;
}

export function hostsMatch(siteDomain: string, candidate: string | null): boolean {
	const expected = normalizeHost(siteDomain);
	const got = normalizeHost(candidate);
	if (!expected || !got) return false;
	if (expected === got) return true;
	// Allow localhost / 127.0.0.1 interchangeably for local blogs.
	const local = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
	if (local.has(expected) && local.has(got)) return true;
	return got.endsWith(`.${expected}`);
}

export function requestHost(request: Request): string | null {
	const origin = request.headers.get('origin');
	if (origin) return normalizeHost(origin);
	const referer = request.headers.get('referer');
	if (referer) return normalizeHost(referer);
	return null;
}
