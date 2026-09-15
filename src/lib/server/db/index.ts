import { createHash, randomBytes } from 'node:crypto';
import { usePostgres } from '$lib/server/config';
import type { Store } from './types';

export type {
	EventInput,
	Site,
	SiteTrackingPatch,
	StatsSummary,
	Store,
	User,
	PlanId
} from './types';

let storePromise: Promise<Store> | null = null;

export function getStore(): Promise<Store> {
	if (!storePromise) {
		storePromise = usePostgres()
			? import('./postgres').then((m) => m.createPostgresStore())
			: import('./sqlite').then((m) => Promise.resolve(m.createSqliteStore()));
	}
	return storePromise;
}

export function hashVisitor(ip: string, ua: string, salt: string): string {
	return createHash('sha256').update(`${ip}|${ua}|${salt}`).digest('hex').slice(0, 32);
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function newToken(bytes = 32): string {
	return randomBytes(bytes).toString('hex');
}

export function currentYyyymm(d = new Date()): string {
	return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Back-compat sync-ish wrappers used during migration of route files.
export async function listSites(userId?: string | null) {
	return (await getStore()).listSites(userId);
}

export async function getSite(id: string) {
	return (await getStore()).getSite(id);
}

export async function createSite(
	name: string,
	domain: string,
	userId?: string | null,
	opts?: { ignoreLocalhost?: boolean }
) {
	return (await getStore()).createSite(name, domain, userId, opts);
}

export async function updateSiteTracking(
	id: string,
	patch: import('./types').SiteTrackingPatch
) {
	return (await getStore()).updateSiteTracking(id, patch);
}

export async function deleteSite(id: string) {
	return (await getStore()).deleteSite(id);
}

export async function insertEvent(
	event: import('./types').EventInput
) {
	return (await getStore()).insertEvent(event);
}

export async function insertEvents(
	events: import('./types').EventInput[]
) {
	const store = await getStore();
	if (store.insertEvents) {
		return store.insertEvents(events);
	}
	for (const event of events) {
		await store.insertEvent(event);
	}
}

export async function clearSiteEvents(siteId: string) {
	const store = await getStore();
	if (store.clearSiteEvents) {
		return store.clearSiteEvents(siteId);
	}
}

export async function getStats(siteId: string, days = 7, points?: number) {
	return (await getStore()).getStats(siteId, days, points);
}

export async function getStatsRange(siteId: string, startMs: number, endMs: number, points?: number) {
	return (await getStore()).getStatsRange(siteId, startMs, endMs, points);
}
