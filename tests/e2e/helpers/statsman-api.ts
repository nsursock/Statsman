import { expect, type APIRequestContext } from '@playwright/test';
import { STATSMAN_URL } from './ports';

export async function openAccess(request: APIRequestContext) {
	const response = await request.post(`${STATSMAN_URL}/api/auth/login`, { data: { openAccess: true } });
	expect(response.ok()).toBeTruthy();
	const cookie = response.headers()['set-cookie']?.split(';')[0];
	if (!cookie) throw new Error('Missing Statsman access cookie');
	return cookie;
}

export async function getStats(request: APIRequestContext, siteId: string, cookie: string) {
	const response = await request.get(`${STATSMAN_URL}/api/stats?siteId=${siteId}&days=7`, { headers: { Cookie: cookie } });
	expect(response.ok()).toBeTruthy();
	return (await response.json()).stats;
}

export async function patchSite(request: APIRequestContext, siteId: string, cookie: string, patch: Record<string, unknown>) {
	const response = await request.patch(`${STATSMAN_URL}/api/sites/${siteId}`, { headers: { Cookie: cookie }, data: patch });
	expect(response.ok()).toBeTruthy();
	return response.json();
}

export async function postEvent(request: APIRequestContext, siteId: string, origin: string, name = 'pageview', path = '/') {
	return request.post(`${STATSMAN_URL}/api/event`, { headers: { 'Content-Type': 'text/plain', Origin: origin, Referer: `${origin}${path}` }, data: JSON.stringify({ siteId, name, path }) });
}

export async function pollStats(request: APIRequestContext, siteId: string, cookie: string, predicate: (stats: any) => boolean): Promise<any> {
	let latest: any;
	await expect.poll(async () => {
		latest = await getStats(request, siteId, cookie);
		return predicate(latest);
	}, { timeout: 10_000 }).toBeTruthy();
	if (!latest) throw new Error(`No stats returned for ${siteId}`);
	return latest;
}
