import { expect, test } from '@playwright/test';
import { collectBeacons } from '../helpers/beacons';
import { LAB_URL, SITE_CT } from '../helpers/ports';
import { getStats, openAccess, patchSite } from '../helpers/statsman-api';

async function waitFor(beacons: Record<string, any>[], name: string) {
	await expect.poll(() => beacons.filter((b) => b.name === name).length).toBeGreaterThan(0);
	return beacons.find((b) => b.name === name)!;
}

test.describe('tracker', () => {
	test.beforeEach(async ({ context }) => context.clearCookies());

	test('emits pageviews, custom events, route changes and honors ignored paths', async ({ page }) => {
		const { beacons } = collectBeacons(page);
		await page.goto(`${LAB_URL}/`);
		const pageview = await waitFor(beacons, 'pageview');
		expect(pageview).toMatchObject({ siteId: SITE_CT, path: '/', referrer: null, title: 'Tracker Lab' });
		expect(pageview.lang).toBeTruthy();
		expect(pageview.screen).toMatch(/x/);
		await page.click('#custom');
		expect(await waitFor(beacons, 'lab_event')).toMatchObject({ data: { x: 1 } });
		await page.click('#spa');
		expect((await waitFor(beacons, 'route_change')).data.from).toBe('/');
		await expect.poll(() => beacons.some((b) => b.name === 'pageview' && b.path === '/spa/2')).toBeTruthy();
		const count = beacons.length;
		await page.click('#same');
		await page.waitForTimeout(100);
		expect(beacons).toHaveLength(count);
		await page.click('#ignored');
		await page.waitForTimeout(100);
		expect(beacons).toHaveLength(count);
		await page.click('#home');
		await expect.poll(() => beacons.some((b) => b.name === 'pageview' && b.path === '/')).toBeTruthy();
	});

	test('emits scroll, engagement, outbound and download events', async ({ page }) => {
		const capture = collectBeacons(page);
		await page.goto(`${LAB_URL}/scroll.html`);
		await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
		for (const name of ['scroll_25', 'scroll_50', 'scroll_75', 'scroll_90']) await waitFor(capture.beacons, name);
		expect(await waitFor(capture.beacons, 'engaged_visit')).toMatchObject({ data: { scrolled: true } });
		await page.evaluate(() => dispatchEvent(new Event('pagehide')));
		expect((await waitFor(capture.beacons, 'engagement')).duration).toBeGreaterThanOrEqual(0);
		await page.goto(`${LAB_URL}/`);
		const popup = page.waitForEvent('popup');
		await page.click('#outbound');
		(await popup).close();
		expect((await waitFor(capture.beacons, 'outbound_link')).data.href).toContain('example.com/out');
		await page.click('#download');
		expect((await waitFor(capture.beacons, 'download')).data.file).toBe('a.pdf');
	});

	test('persists opt-out and ignores development hosts without opt-in', async ({ page }) => {
		const { beacons } = collectBeacons(page);
		await page.goto(`${LAB_URL}/?statsman_debug=1`);
		await page.waitForTimeout(150);
		expect(beacons).toHaveLength(0);
		expect(await page.evaluate(() => window.statsman.isOptedOut())).toBe(true);
		await page.reload();
		await page.waitForTimeout(100);
		expect(beacons).toHaveLength(0);
		await page.evaluate(() => window.statsman.enableTracking());
		await page.goto(`${LAB_URL}/`);
		await waitFor(beacons, 'pageview');
		beacons.length = 0;
		await page.goto(`${LAB_URL}/no-allow.html`);
		await page.waitForTimeout(150);
		expect(beacons).toHaveLength(0);
	});

	test('server drops local traffic when the site requests it', async ({ page, request }) => {
		const cookie = await openAccess(request);
		const before = (await getStats(request, SITE_CT, cookie)).pageviews;
		try {
			await patchSite(request, SITE_CT, cookie, { ignore_localhost: true });
			const { statuses } = collectBeacons(page);
			await page.goto(`${LAB_URL}/`);
			await expect.poll(() => statuses.length).toBeGreaterThan(0);
			expect(statuses[0]).toBe(204);
			await page.waitForTimeout(150);
			expect((await getStats(request, SITE_CT, cookie)).pageviews).toBe(before);
		} finally {
			await patchSite(request, SITE_CT, cookie, { ignore_localhost: false });
		}
	});
});

declare global { interface Window { statsman: { isOptedOut(): boolean; enableTracking(): void } } }
