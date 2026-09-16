import { expect, test } from '@playwright/test';
import { SITE_CT, SITE_TIL, STATSMAN_URL } from '../helpers/ports';
import { openAccess, patchSite, pollStats, postEvent } from '../helpers/statsman-api';

function stat(page: import('@playwright/test').Page, label: string) {
	return page.locator('.stat-tile').filter({ hasText: label }).locator('.stat-value');
}

test('dashboard renders both blogs and manages tracker settings', async ({ page, request }) => {
	const cookie = await openAccess(request);
	for (let i = 0; i < 4; i++) {
		await postEvent(request, SITE_CT, 'http://127.0.0.1:4181', 'pageview', `/ct-dashboard-${i}`);
		await postEvent(request, SITE_TIL, 'http://127.0.0.1:4182', 'pageview', `/til-dashboard-${i}`);
	}
	await postEvent(request, SITE_CT, 'http://127.0.0.1:4181', 'scroll_90', '/ct-dashboard-0');
	await postEvent(request, SITE_TIL, 'http://127.0.0.1:4182', 'cta_click', '/til-dashboard-0');
	await postEvent(request, SITE_TIL, 'http://127.0.0.1:4182', 'cta_click', '/til-dashboard-0');
	await pollStats(request, SITE_TIL, cookie, (stats) => stats.customEvents.some((event: any) => event.label === 'cta_click'));
	await page.goto(`${STATSMAN_URL}/login`);
	await page.getByRole('button', { name: 'Enter console' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.locator('.dash-nav__site-btn').click();
	await expect(page.getByRole('listbox', { name: 'Sites' })).toContainText('Come & Terry (e2e)');
	await expect(page.getByRole('listbox', { name: 'Sites' })).toContainText('TIL Blog (e2e)');
	await page.goto(`${STATSMAN_URL}/dashboard?site=${SITE_TIL}&days=7`);
	await expect.poll(async () => Number((await stat(page, 'Pageviews').textContent())?.replace(/,/g, ''))).toBeGreaterThanOrEqual(4);
	await expect(page.locator('body')).toContainText('/til-dashboard-0');
	await expect(page.locator('body')).toContainText('cta_click');
	await page.goto(`${STATSMAN_URL}/dashboard?site=${SITE_CT}&days=7`);
	await expect(page.locator('body')).toContainText('/ct-dashboard-0');
	await expect(page.locator('body')).toContainText('scroll_90');
	await page.goto(`${STATSMAN_URL}/dashboard?site=${SITE_TIL}&days=7`);
	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('tab', { name: /Tracker/ }).click();
	await expect(page.locator('.snippet-code').first()).toContainText(`data-site="${SITE_TIL}"`);
	await expect(page.locator('.snippet-code').first()).toContainText('http://localhost:4173/tracker.js');
	const toggle = page.getByRole('checkbox', { name: /Ignore localhost/ });
	await expect(toggle).not.toBeChecked();
	const onRequest = page.waitForRequest((req) => req.url().endsWith(`/api/sites/${SITE_TIL}`) && req.method() === 'PATCH');
	await toggle.check();
	expect((await onRequest).postDataJSON()).toMatchObject({ ignore_localhost: true });
	await expect(toggle).toBeChecked();
	const offRequest = page.waitForRequest((req) => req.url().endsWith(`/api/sites/${SITE_TIL}`) && req.method() === 'PATCH');
	await toggle.uncheck();
	expect((await offRequest).postDataJSON()).toMatchObject({ ignore_localhost: false });
	await expect(toggle).not.toBeChecked();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'More' }).click();
	await expect(page.getByRole('menuitem', { name: 'Log out' })).toHaveAttribute('href', '/auth/logout');
	await page.goto(`${STATSMAN_URL}/auth/logout`);
	await page.goto(`${STATSMAN_URL}/dashboard`);
	await expect(page).toHaveURL(/\/login/);
	await patchSite(request, SITE_TIL, cookie, { ignore_localhost: false });
});
