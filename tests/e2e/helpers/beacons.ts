import type { Page, Request } from '@playwright/test';

export type Beacon = Record<string, any>;

export function collectBeacons(page: Page) {
	const beacons: Beacon[] = [];
	const statuses: number[] = [];
	page.on('request', (request: Request) => {
		if (!request.url().endsWith('/api/event') || request.method() !== 'POST') return;
		try { beacons.push(JSON.parse(request.postData() ?? '{}')); } catch {}
	});
	page.on('response', (response) => {
		if (response.url().endsWith('/api/event')) statuses.push(response.status());
	});
	return { beacons, statuses };
}

export async function waitForBeacon(page: Page, beacons: Beacon[], name: string, path?: string) {
	await page.waitForFunction(({ name, path }) => {
		const list = (window as any).__e2eBeacons as Beacon[] | undefined;
		return list?.some((item) => item.name === name && (!path || item.path.includes(path)));
	}, { name, path });
	return beacons.find((item) => item.name === name && (!path || item.path.includes(path)));
}

export async function exposeBeaconList(page: Page, beacons: Beacon[]) {
	await page.exposeFunction('__recordE2EBeacon', (beacon: Beacon) => beacons.push(beacon));
}
