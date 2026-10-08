const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function isLocalHostname(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	return !host || LOCAL_HOSTS.has(host) || host.endsWith('.local');
}

export function isLocalOrigin(origin: string): boolean {
	try {
		return isLocalHostname(new URL(origin).hostname);
	} catch {
		return true;
	}
}

function cleanOrigin(origin: string): string {
	return origin.trim().replace(/\/$/, '');
}

/**
 * Origin embedded in signup confirmation and password-reset emails.
 * A configured public PUBLIC_ORIGIN always wins. In production, a leftover
 * localhost PUBLIC_ORIGIN must not beat the host the user actually signed up on.
 */
export function pickAuthEmailOrigin(input: {
	configured: string;
	requestOrigin: string;
	adapterOrigin?: string;
	forwardedOrigin?: string | null;
	dev: boolean;
}): string {
	const configured = cleanOrigin(input.configured);
	if (configured && !isLocalOrigin(configured)) return configured;
	if (input.dev) return configured || 'http://localhost:5173';

	const candidates = [input.adapterOrigin, input.requestOrigin, input.forwardedOrigin];
	for (const candidate of candidates) {
		if (!candidate) continue;
		const origin = cleanOrigin(candidate);
		if (origin && !isLocalOrigin(origin)) return origin;
	}
	return configured || 'http://localhost:5173';
}

/** Public origin from a reverse proxy. Ignores malformed or credential-bearing hosts. */
export function forwardedOrigin(request: Request): string | null {
	const rawHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? '';
	if (!rawHost || /[\s/\\@]/.test(rawHost)) return null;
	const rawProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() ?? '';
	const proto = rawProto === 'http' || rawProto === 'https' ? rawProto : 'https';
	try {
		return new URL(`${proto}://${rawHost}`).origin;
	} catch {
		return null;
	}
}
