import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { collectBeacons } from '../helpers/beacons';
import { SITE_TIL, TIL_URL } from '../helpers/ports';
import { getStats, openAccess, pollStats } from '../helpers/statsman-api';

test('TilBlog sends pageviews and business events through Statsman', async ({ page, request }) => {
	const cookie = await openAccess(request);
	const baseline = await getStats(request, SITE_TIL, cookie);
	const { beacons } = collectBeacons(page);
	await page.goto(`${TIL_URL}/`);
	await expect(page.locator(`script[src="http://localhost:4173/tracker.js"][data-site="${SITE_TIL}"][data-allow-localhost]`)).toHaveCount(1);
	await page.locator('a[data-til-event="cta_click"][data-til-label="read_latest"]').click();
	await expect.poll(() => beacons.some((b) => b.name === 'cta_click')).toBeTruthy();
	expect(beacons.find((b) => b.name === 'cta_click')?.data).toMatchObject({ label: 'read_latest', path: '/' });
	const lessons = path.resolve('.e2e/blogs/tilblog/dist/posts/problem-solving');
	const first = fs.readdirSync(lessons, { withFileTypes: true }).find((entry) => entry.isDirectory())?.name;
	expect(first).toBeTruthy();
	await page.goto(`${TIL_URL}/posts/problem-solving/${first}/`);
	await expect.poll(() => beacons.some((b) => b.name === 'lesson_open')).toBeTruthy();
	const opened = beacons.find((b) => b.name === 'lesson_open')!.data;
	expect(opened.track).toBeTruthy();
	expect(opened.level).toBeTruthy();
	expect(opened.title).toBeTruthy();
	const nav = page.locator('[data-til-event="lesson_nav"]').first();
	await expect(nav).toBeVisible();
	await nav.click();
	await expect.poll(() => beacons.some((b) => b.name === 'lesson_nav')).toBeTruthy();
	expect(['prev', 'next']).toContain(beacons.find((b) => b.name === 'lesson_nav')?.data.label);
	const copyRegion = page.locator('pre code, .prose-til').first();
	await expect(copyRegion).toBeVisible();
	await copyRegion.evaluate((element) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		const text = walker.nextNode();
		if (!text) throw new Error('Copy region has no text');
		const range = document.createRange();
		range.selectNodeContents(text);
		getSelection()?.removeAllRanges();
		getSelection()?.addRange(range);
		document.dispatchEvent(new Event('copy', { bubbles: true }));
	});
	await expect.poll(() => beacons.some((b) => b.name === 'code_copy')).toBeTruthy();
	const stats = await pollStats(request, SITE_TIL, cookie, (current) => current.pageviews >= baseline.pageviews + 3 && ['lesson_open', 'cta_click', 'lesson_nav', 'code_copy'].every((name) => current.customEvents.some((event: any) => event.label === name)));
	expect(stats.pageviews).toBeGreaterThanOrEqual(baseline.pageviews + 3);
});

test.fixme('comment_submit requires Supabase comments infrastructure', async () => {});
