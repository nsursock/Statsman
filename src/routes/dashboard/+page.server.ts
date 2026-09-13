import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';
import { listSites, getStats, getStore, currentYyyymm } from '$lib/server/db';
import { getPublicOrigin, isCloud } from '$lib/server/config';
import { effectiveCloudLimits } from '$lib/server/plans';
import { billingEnabled, reconcileUserPlanFromStripe } from '$lib/server/stripe';
import { ensureFounderPlan } from '$lib/server/founder';
import {
	DEMO_SITE_NAME,
	demoEnabled,
	demoSeedEnabled,
	getDemoSite,
	seedDemoTraffic
} from '$lib/server/demo';
import { needsOnboarding, operatorSites } from '$lib/server/onboarding';
import { parseChartParam, parsePointsParam } from '$lib/timeseries';
import { resolveClientIp } from '$lib/server/geo';

export const load: PageServerLoad = async ({ url, locals, request, getClientAddress }) => {
	if (isCloud()) {
		if (!locals.user) redirect(303, '/login');
	} else if (!locals.adminOk) {
		redirect(303, '/login');
	}

	const store = await getStore();

	if (isCloud() && locals.user) {
		locals.user = await ensureFounderPlan(locals.user);
	}

	// Always mirror Stripe → local plan before rendering Account / limits.
	if (isCloud() && locals.user && billingEnabled()) {
		const snap = await reconcileUserPlanFromStripe(locals.user.id);
		const fresh = await store.getUserById(locals.user.id);
		if (fresh) {
			locals.user = fresh;
		} else {
			locals.user = { ...locals.user, plan: snap.plan };
		}
		// Re-assert founder after reconcile (belt + suspenders).
		locals.user = await ensureFounderPlan(locals.user);
	}

	const allSites = isCloud() && locals.user ? await listSites(locals.user.id) : await listSites();
	// Demo Site is a public lab — never list it among the operator's tracked websites.
	const sites = operatorSites(allSites);
	const showOnboarding =
		needsOnboarding(allSites) && url.searchParams.get('skip_onboarding') !== '1';

	// Reuse the sites list — avoid a second listSites() round trip via getDemoSite().
	let demo = demoEnabled() ? allSites.find((s) => s.name === DEMO_SITE_NAME) : undefined;
	if (demoEnabled() && !demo) {
		demo = await getDemoSite();
	}
	// Seed only when explicitly enabled (dev default). Never block dashboard on prod seed.
	if (demo && demoSeedEnabled()) {
		void seedDemoTraffic(demo.id).catch((err) =>
			console.error('[statsman] demo seed failed', err)
		);
	}

	const siteId = url.searchParams.get('site');
	// Ignore demo id in ?site= so it can't reappear as the active tracked site.
	const site = (siteId && sites.find((s) => s.id === siteId)) || sites[0] || null;
	const days = Number(url.searchParams.get('days') ?? 7);
	const range = Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 7;
	const points = parsePointsParam(url.searchParams.get('points'));
	const chart = parseChartParam(url.searchParams.get('chart'));

	const plan = locals.user?.plan ?? 'free';
	const [stats, recentEvents, usage] = await Promise.all([
		site ? getStats(site.id, range, points) : Promise.resolve(null),
		site ? store.getRecentEvents(site.id, 14) : Promise.resolve([]),
		isCloud() && locals.user
			? store.getMonthlyUsage(locals.user.id, currentYyyymm()).then((used) => {
					const limits = effectiveCloudLimits(plan);
					const paid = billingEnabled();
					return {
						used,
						limit: limits.pageviews,
						sitesLimit: limits.sites,
						sitesUsed: sites.length,
						plan: paid ? plan : plan === 'founder' ? 'founder' : 'beta',
						pct: Math.min(100, Math.round((used / Math.max(limits.pageviews, 1)) * 100)),
						overCap: paid && used >= limits.pageviews
					};
				})
			: Promise.resolve(null)
	]);

	const hasEvents = recentEvents.length > 0 || (stats?.pageviews ?? 0) > 0;

	return {
		sites,
		site,
		days: range,
		points,
		chart,
		stats,
		hasEvents,
		recentEvents: hasEvents ? recentEvents : [],
		isCloud: isCloud(),
		isDev: dev,
		demoSiteId: demo?.id ?? null,
		user: locals.user,
		usage,
		billingEnabled: billingEnabled(),
		billingFlash: url.searchParams.get('billing'),
		needsOnboarding: showOnboarding,
		publicOrigin: getPublicOrigin(),
		firstOperatorSite: sites[0] ?? null,
		clientIp: resolveClientIp(request, getClientAddress())
	};
};
