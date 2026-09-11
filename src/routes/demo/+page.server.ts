import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { demoSeedEnabled, getDemoSite, seedDemoTraffic } from '$lib/server/demo';
import { demoPosts } from '$lib/demo-posts';

export const load: PageServerLoad = async ({ url }) => {
	const site = await getDemoSite();
	if (!site) redirect(303, '/');
	if (demoSeedEnabled()) await seedDemoTraffic(site.id);

	const slug = url.searchParams.get('p');
	const post = demoPosts.find((p) => p.slug === slug) ?? null;
	const idx = post ? demoPosts.indexOf(post) : -1;

	return {
		siteId: site.id,
		post,
		posts: demoPosts.map(({ slug: s, title, date, excerpt }) => ({ slug: s, title, date, excerpt })),
		next: post ? (demoPosts[(idx + 1) % demoPosts.length] ?? null) : null
	};
};
