import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getStats, getStore } from '$lib/server/db';
import { demoSeedEnabled, getDemoSite, seedDemoTraffic } from '$lib/server/demo';

/** Public, ungated demo analytics — no login required. */
export const load: PageServerLoad = async ({ url }) => {
	const site = await getDemoSite();
	if (!site) redirect(303, '/');
	if (demoSeedEnabled()) await seedDemoTraffic(site.id);

	const days = Number(url.searchParams.get('days') ?? 7);
	const range = Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 7;
	const stats = await getStats(site.id, range);
	const store = await getStore();
	const recentEvents = await store.getRecentEvents(site.id, 14);

	return {
		site: { id: site.id, name: site.name, domain: site.domain },
		days: range,
		stats,
		recentEvents
	};
};
