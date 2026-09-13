import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/public';
import { demoSeedEnabled, getDemoSite, seedDemoTraffic } from '$lib/server/demo';
import { demoPosts } from '$lib/demo-posts';
import { getSite } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
	const dogfoodId = (env.PUBLIC_ANALYTICS_SITE_ID ?? '').trim();
	const dogfood = dogfoodId ? await getSite(dogfoodId) : undefined;
	const site = dogfood ?? (await getDemoSite());
	if (!site) redirect(303, '/');

	// Synthetic seed stays on the anonymous Demo Site only.
	if (!dogfood && demoSeedEnabled()) await seedDemoTraffic(site.id);

	const slug = url.searchParams.get('p');
	const post = demoPosts.find((p) => p.slug === slug) ?? null;
	const idx = post ? demoPosts.indexOf(post) : -1;

	return {
		siteId: site.id,
		siteName: site.name,
		post,
		posts: demoPosts.map(({ slug: s, title, date, excerpt }) => ({ slug: s, title, date, excerpt })),
		next: post ? (demoPosts[(idx + 1) % demoPosts.length] ?? null) : null
	};
};
