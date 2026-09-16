import { expect, test } from '@playwright/test';
import { getStats, openAccess, pollStats } from '../helpers/statsman-api';
import { STATSMAN_URL } from '../helpers/ports';

test.describe('selfhost API', () => {
	test('health, access, event acceptance and cloud-only routes', async ({ request }) => {
		const health = await request.get(`${STATSMAN_URL}/api/health`).then((r) => r.json());
		expect(health).toMatchObject({ ok: true, mode: 'selfhost', db: 'sqlite', authReady: true });
		expect((await request.post(`${STATSMAN_URL}/api/auth/login`, { data: { email: 'no@example.com', password: 'x' } })).ok()).toBeFalsy();
		expect((await request.get(`${STATSMAN_URL}/api/sites`)).status()).toBe(401);
		expect((await request.get(`${STATSMAN_URL}/dashboard`, { maxRedirects: 0 })).status()).toBe(303);
		const cookie = await openAccess(request);
		const stamp = Date.now().toString(36);
		const create = await request.post(`${STATSMAN_URL}/api/sites`, { headers: { Cookie: cookie }, data: { name: `Selfhost ${stamp}`, domain: `selfhost-${stamp}.example.com` } });
		expect(create.status()).toBe(201);
		const site = (await create.json()).site;
		await request.patch(`${STATSMAN_URL}/api/sites/${site.id}`, { headers: { Cookie: cookie }, data: { ignore_localhost: false } });
		const before = (await getStats(request, site.id, cookie)).pageviews;
		for (let i = 0; i < 5; i++) {
			const event = await request.post(`${STATSMAN_URL}/api/event`, { headers: { 'Content-Type': 'text/plain', Origin: `https://${site.domain}` }, data: JSON.stringify({ siteId: site.id, path: `/p/${i}`, name: 'pageview' }) });
			expect([200, 204]).toContain(event.status());
		}
		await pollStats(request, site.id, cookie, (stats) => stats.pageviews >= before + 5);
		expect((await request.get(`${STATSMAN_URL}/billing`, { headers: { Cookie: cookie }, maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
		expect((await request.post(`${STATSMAN_URL}/api/billing/subscribe`, { headers: { Cookie: cookie }, data: { plan: 'indie' } })).ok()).toBeFalsy();
		expect((await request.delete(`${STATSMAN_URL}/api/sites/${site.id}`, { headers: { Cookie: cookie } })).ok()).toBeTruthy();
		expect((await request.get(`${STATSMAN_URL}/api/stats?siteId=${site.id}`, { headers: { Cookie: cookie } })).status()).toBe(404);
	});

	test('soft drops bad domains, unknown sites and excluded IPs', async ({ request }) => {
		const cookie = await openAccess(request);
		const create = await request.post(`${STATSMAN_URL}/api/sites`, { headers: { Cookie: cookie }, data: { name: `Guard ${Date.now()}`, domain: 'allowed.example.com' } });
		const site = (await create.json()).site;
		try {
			const before = (await getStats(request, site.id, cookie)).pageviews;
			const rejected = await request.post(`${STATSMAN_URL}/api/event`, { headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example.org' }, data: JSON.stringify({ siteId: site.id, name: 'pageview', path: '/bad' }) });
			expect(rejected.status()).toBe(204);
			await new Promise((resolve) => setTimeout(resolve, 150));
			expect((await getStats(request, site.id, cookie)).pageviews).toBe(before);
			expect((await request.post(`${STATSMAN_URL}/api/event`, { data: '{' })).status()).toBe(400);
			expect((await request.post(`${STATSMAN_URL}/api/event`, { data: JSON.stringify({ siteId: 'unknown' }) })).status()).toBe(204);
			const options = await request.fetch(`${STATSMAN_URL}/api/event`, { method: 'OPTIONS' });
			expect(options.status()).toBe(204);
			expect(options.headers()['access-control-allow-origin']).toBe('*');
			await request.patch(`${STATSMAN_URL}/api/sites/${site.id}`, { headers: { Cookie: cookie }, data: { excluded_ips: ['127.0.0.1'] } });
			await request.post(`${STATSMAN_URL}/api/event`, { headers: { 'Content-Type': 'text/plain', Origin: 'https://allowed.example.com' }, data: JSON.stringify({ siteId: site.id, name: 'pageview', path: '/excluded' }) });
			await new Promise((resolve) => setTimeout(resolve, 150));
			expect((await getStats(request, site.id, cookie)).pageviews).toBe(before);
		} finally {
			await request.delete(`${STATSMAN_URL}/api/sites/${site.id}`, { headers: { Cookie: cookie } });
		}
	});

	test.skip('admin-token unlock needs a token-configured instance', async () => {});
});
