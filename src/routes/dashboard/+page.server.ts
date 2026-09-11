import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';
import { listSites, getStats, getStore, currentYyyymm } from '$lib/server/db';
import { getPublicOrigin, isCloud } from '$lib/server/config';
import { planLimits } from '$lib/server/plans';
import { billingEnabled } from '$lib/server/stripe';
import { demoSeedEnabled, getDemoSite, seedDemoTraffic } from '$lib/server/demo';
import { needsOnboarding, operatorSites } from '$lib/server/onboarding';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (isCloud()) {
		if (!locals.user) redirect(303, '/login');
	} else if (!locals.adminOk) {
		redirect(303, '/login');
	}

	const allSites = isCloud() && locals.user ? await listSites(locals.user.id) : await listSites();
	// Demo Site is a public lab — never list it among the operator's tracked websites.
	const sites = operatorSites(allSites);
	const showOnboarding =
		needsOnboarding(allSites) && url.searchParams.get('skip_onboarding') !== '1';

	const demo = await getDemoSite();
	if (demo && demoSeedEnabled()) await seedDemoTraffic(demo.id);

	const siteId = url.searchParams.get('site');
	// Ignore demo id in ?site= so it can't reappear as the active tracked site.
	const site =
		(siteId && sites.find((s) => s.id === siteId)) ||
		sites[0] ||
		null;
	const days = Number(url.searchParams.get('days') ?? 7);
	const stats = site
		? await getStats(site.id, Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 7)
		: null;
	const hasEvents = site ? await (await getStore()).siteHasEvents(site.id) : false;
	const recentEvents = site && hasEvents ? await (await getStore()).getRecentEvents(site.id, 14) : [];

	let usage = null;
	if (isCloud() && locals.user) {
		const store = await getStore();
		const limits = planLimits(locals.user.plan);
		const used = await store.getMonthlyUsage(locals.user.id, currentYyyymm());
		usage = {
			used,
			limit: limits.pageviews,
			sitesLimit: limits.sites,
			sitesUsed: sites.length,
			plan: locals.user.plan,
			pct: Math.min(100, Math.round((used / Math.max(limits.pageviews, 1)) * 100)),
			overCap: used >= limits.pageviews
		};
	}

	return {
		sites,
		site,
		days: Number.isFinite(days) ? days : 7,
		stats,
		hasEvents,
		recentEvents,
		isCloud: isCloud(),
		isDev: dev,
		demoSiteId: demo?.id ?? null,
		user: locals.user,
		usage,
		billingEnabled: billingEnabled(),
		billingFlash: url.searchParams.get('billing'),
		needsOnboarding: showOnboarding,
		publicOrigin: getPublicOrigin(),
		firstOperatorSite: sites[0] ?? null
	};
};
