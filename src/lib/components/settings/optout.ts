import type { Site } from './types';

const OPTOUT_KEY = 'statsman_optout';

export function readOptOut(): boolean {
	if (typeof document === 'undefined') return false;
	try {
		if (localStorage.getItem(OPTOUT_KEY) === 'true') return true;
	} catch {
		/* ignore */
	}
	try {
		return document.cookie.split(';').some((c) => c.trim().startsWith(`${OPTOUT_KEY}=true`));
	} catch {
		return false;
	}
}

export function writeOptOut(enabled: boolean) {
	try {
		if (enabled) localStorage.setItem(OPTOUT_KEY, 'true');
		else localStorage.removeItem(OPTOUT_KEY);
	} catch {
		/* ignore */
	}
	try {
		document.cookie = enabled
			? `${OPTOUT_KEY}=true;path=/;max-age=${3650 * 86400};SameSite=Lax`
			: `${OPTOUT_KEY}=;path=/;max-age=0;SameSite=Lax`;
	} catch {
		/* ignore */
	}
	const api = (window as unknown as { statsman?: { disableTracking?: () => void; enableTracking?: () => void } })
		.statsman;
	if (enabled) api?.disableTracking?.();
	else api?.enableTracking?.();
}

export function parseIps(site: Site | null | undefined): string[] {
	if (!site?.excluded_ips) return [];
	if (Array.isArray(site.excluded_ips)) return site.excluded_ips.map(String);
	try {
		const parsed = JSON.parse(site.excluded_ips) as unknown;
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}
