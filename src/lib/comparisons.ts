export type Competitor = {
	slug: string;
	name: string;
	tagline: string;
	startingPrice: string;
	selfHost: boolean;
	license: string;
	storage: string;
	trackerSize: string;
	hasLiveDemo: boolean;
	aesthetic: string;
	freeCloudTier: string;
	/** Where Statsman wins vs this competitor. */
	statsmanWins: string[];
	/** Honest acknowledgment of competitor strengths. */
	competitorWins: string[];
	/** SEO meta description. */
	metaDescription: string;
};

export const COMPETITORS: Competitor[] = [
	{
		slug: 'plausible',
		name: 'Plausible',
		tagline: 'The category benchmark — Google Analytics without the surveillance.',
		startingPrice: '$9/mo',
		selfHost: true,
		license: 'AGPLv3',
		storage: 'ClickHouse (self-host) / managed (cloud)',
		trackerSize: '~1.9 KB',
		hasLiveDemo: false,
		aesthetic: 'Clean, minimal, corporate-friendly',
		freeCloudTier: 'No free cloud tier',
		statsmanWins: [
			'Starts at $3/mo vs Plausible\'s $9/mo — one-third the price for the core indie blog use case',
			'Live demo console with 30 days of seeded data, no signup required — Plausible has no equivalent',
			'ScifiUI mission-control aesthetic with 3D Earth globe vs Plausible\'s utilitarian dashboard',
			'Self-host runs on SQLite or Postgres — no ClickHouse cluster to operate',
			'MIT license vs AGPLv3 — no copyleft concerns for self-hosters'
		],
		competitorWins: [
			'Strongest brand recognition in the privacy-analytics category',
			'Mature WordPress plugin ecosystem and integrations',
			'Goals, funnels, and revenue tracking features',
			'Years of uptime history and trust at scale'
		],
		metaDescription:
			'Statsman vs Plausible — same privacy-first, cookieless analytics at one-third the price. Live demo, ScifiUI console, SQLite self-host without ClickHouse.'
	},
	{
		slug: 'fathom',
		name: 'Fathom',
		tagline: 'Premium SaaS analytics — analytics without surveillance.',
		startingPrice: '$15/mo',
		selfHost: false,
		license: 'Closed source (Lite version open)',
		storage: 'Managed (cloud only)',
		trackerSize: '~1 KB',
		hasLiveDemo: false,
		aesthetic: 'Polished, minimal, enterprise-friendly',
		freeCloudTier: 'No free cloud tier',
		statsmanWins: [
			'Starts at $3/mo vs Fathom\'s $15/mo — 80% cheaper for the same core value',
			'Free self-host option — Fathom has no real self-host path',
			'Live demo console with 30 days of seeded data, no signup required',
			'ScifiUI mission-control aesthetic — Fathom\'s dashboard is clean but conventional',
			'MIT-licensed open source vs Fathom\'s closed-source cloud'
		],
		competitorWins: [
			'Extremely polished, battle-tested SaaS product',
			'Unlimited sites on every plan',
			'EU data isolation and enterprise compliance features',
			'Zero ops — fully managed, no infrastructure to think about'
		],
		metaDescription:
			'Statsman vs Fathom — privacy-first analytics at $3/mo instead of $15/mo. Free self-host, live demo, ScifiUI console. Same cookieless tracking, fraction of the price.'
	},
	{
		slug: 'umami',
		name: 'Umami',
		tagline: 'The self-hosting favorite — open-source analytics on your own server.',
		startingPrice: 'Free (self-host) / $20/mo (cloud)',
		selfHost: true,
		license: 'MIT',
		storage: 'Postgres / MySQL',
		trackerSize: '~2 KB',
		hasLiveDemo: false,
		aesthetic: 'Clean, functional, utilitarian',
		freeCloudTier: '1M events/mo free (cloud)',
		statsmanWins: [
			'ScifiUI mission-control aesthetic with 3D Earth globe — Umami\'s UI is functional but plain',
			'Live demo console with 30 days of seeded data, no signup required',
			'Cloud pricing starts at $3/mo vs Umami\'s $20/mo Pro tier',
			'Same MIT license, same Postgres support, plus SQLite option for single-binary deploys',
			'Out-of-the-box Stripe billing for anyone who wants to run their own analytics SaaS'
		],
		competitorWins: [
			'Huge community — 20,000+ GitHub stars and extensive documentation',
			'Most generous free cloud tier (1M events/month)',
			'Battle-tested self-hosting with the simplest Docker setup in the category',
			'Event-based tracking, not just pageviews — more flexible for custom analytics'
		],
		metaDescription:
			'Statsman vs Umami — same MIT license and self-host freedom, plus a ScifiUI console, live demo, and cloud from $3/mo. A Umami alternative that\'s actually fun to open.'
	}
];

export function getCompetitor(slug: string): Competitor | undefined {
	return COMPETITORS.find((c) => c.slug === slug);
}
