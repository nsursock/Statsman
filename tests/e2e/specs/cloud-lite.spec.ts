import { expect, test } from '@playwright/test';
import { CLOUD_URL, SITE_TIL } from '../helpers/ports';

test.describe('cloud-lite', () => {
	test('renders cloud pages without configured providers', async ({ page, request }) => {
		const health = await request.get(`${CLOUD_URL}/api/health`).then((r) => r.json());
		expect(health).toMatchObject({ ok: true, mode: 'cloud', authReady: false, billingReady: false });
		await page.goto(CLOUD_URL);
		await expect(page.locator('body')).toContainText('analytics');
		await page.goto(`${CLOUD_URL}/pricing`);
		await expect(page.locator('body')).toContainText(/beta|Indie|Creator/i);
		await page.goto(`${CLOUD_URL}/login`);
		await expect(page.locator('body')).toContainText('Supabase Auth is not configured');
		await expect(page.locator('button[type="submit"]').first()).toBeDisabled();
	});

	test('rejects auth and selfhost access when providers are absent', async ({ request }) => {
		for (const [path, data] of [
			['signup', { email: 'x@example.com', password: 'password123' }],
			['login', { email: 'x@example.com', password: 'password123' }],
			['reset', { email: 'x@example.com' }],
			['bridge', { accessToken: 'x' }],
			['update-password', { accessToken: 'x', password: 'password123' }]
		] as const) expect((await request.post(`${CLOUD_URL}/api/auth/${path}`, { data })).status()).toBe(503);
		expect((await request.get(`${CLOUD_URL}/api/sites`)).status()).toBe(401);
		expect((await request.post(`${CLOUD_URL}/api/auth/login`, { data: { openAccess: true } })).status()).toBe(503);
		expect((await request.post(`${CLOUD_URL}/api/event`, { data: JSON.stringify({ siteId: SITE_TIL, name: 'pageview', path: '/' }) })).status()).toBe(204);
	});

	test('canonical redirect works while health stays local', async ({ request }) => {
		const headers = { 'x-forwarded-host': 'statsman-production.up.railway.app' };
		const redirect = await request.get(`${CLOUD_URL}/pricing`, { headers, maxRedirects: 0 });
		expect(redirect.status()).toBe(301);
		expect(redirect.headers().location).toBe('https://statsman.test/pricing');
		expect((await request.get(`${CLOUD_URL}/api/health`, { headers, maxRedirects: 0 })).status()).toBe(200);
	});
});
