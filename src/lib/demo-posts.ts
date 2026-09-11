/** Fake indie blog used by the /demo lab. Pure data — safe for client + server. */

export type DemoPost = {
	slug: string;
	title: string;
	date: string;
	excerpt: string;
	body: string[];
};

export const DEMO_BLOG_NAME = 'The Perihelion Review';
export const DEMO_BLOG_TAGLINE = 'Notes from a small corner of the web.';

export const demoPosts: DemoPost[] = [
	{
		slug: 'goodbye-google-analytics',
		title: 'Goodbye, Google Analytics',
		date: 'Sep 02, 2026',
		excerpt:
			'I removed 47 KB of surveillance from my blog and replaced it with one honest kilobyte. Here is what I learned about my readers — and about myself.',
		body: [
			'For six years my blog phoned home to Mountain View every time someone read my thoughts on SQLite. The trade never made sense: my readers got a cookie banner, Google got a behavioral profile, and I got a dashboard I opened twice a year to feel bad about bounce rates.',
			'So I ripped it out. The replacement is a single defer-loaded script, about a kilobyte, that posts one small beacon to a box I control. No cookies, no fingerprinting, no consent banner — because there is nothing to consent to.',
			'The surprising part: I look at my stats more often now. When the numbers are yours, stored in a database you can query with actual SQL, they stop being marketing telemetry and start being a conversation with your readers.'
		]
	},
	{
		slug: 'sqlite-forever',
		title: 'SQLite Forever',
		date: 'Aug 21, 2026',
		excerpt:
			'My entire analytics stack is one file in a Docker volume. It backups with `cp`, it migrates with `scp`, and it has never once paged me at 3 AM.',
		body: [
			'Every indie project eventually gets the advice: "just use Postgres." And Postgres is wonderful — when you need it. But my blog analytics do a few hundred writes a day and a handful of reads. That is not a workload. That is a rounding error.',
			'So the whole thing lives in one SQLite file on a volume. Backups are `cp statsman.db statsman.db.bak`. Disaster recovery is `scp`. My runbook fits in a tweet, and my database has never paged me, because it cannot — it is a file.',
			'When I outgrow it, the same app speaks Postgres and I flip one environment variable. Until then: one file, zero daemons, infinite calm.'
		]
	},
	{
		slug: 'the-204-tactic',
		title: 'The 204 Tactic: Fail Open, Not Loud',
		date: 'Aug 09, 2026',
		excerpt:
			'When you blow past your plan limit, my analytics returns a polite 204 and keeps your blog green. Error budgets are for the biller, not the reader.',
		body: [
			'Here is a thing analytics companies get wrong: when you exceed your plan, they throw errors. Your browser console goes red, your monitoring lights up, your readers download a broken page — because you dared to be popular on the wrong Tuesday.',
			'Statsman does the opposite. Over-cap ingest returns 204 No Content. The tracker shrugs and moves on. Your blog stays green, your readers notice nothing, and the only place the overage shows up is a gentle banner in your own dashboard suggesting an upgrade.',
			'Fail open, not loud. The reader experience is sacred; the billing conversation can wait until morning.'
		]
	},
	{
		slug: 'cookie-banner-free',
		title: 'I Deleted My Cookie Banner',
		date: 'Jul 27, 2026',
		excerpt:
			'The fastest way to comply with cookie law is to not use cookies. Revolutionary, I know. My lighthouse score wept with joy.',
		body: [
			'There is a special irony in shipping a 200 KB consent-management platform to ask permission for 40 KB of tracking scripts. The cure weighed five times the disease, and everybody clicked "reject all" anyway.',
			'The elegant fix is subtraction. Cookieless analytics means no cookies, which means no banner, which means no banner-blocking-my-own-headline on a phone screen. My first contentful paint got faster. My soul got lighter.',
			'Privacy people call this "data minimization." I call it "deleting the annoying part." Both are correct.'
		]
	},
	{
		slug: 'indie-infra-zero-budget',
		title: 'Indie Infra on a $0 Budget',
		date: 'Jul 12, 2026',
		excerpt:
			'A blog, an analytics console, and a newsletter — hosted for the price of a domain name. The trick is boring technology and ruthless deletion.',
		body: [
			'My entire web presence costs eleven dollars a year, and that is just the domain. The blog is static files. The analytics is a single binary with a file for a database. The whole fleet fits on a machine smaller than my phone.',
			'The secret is not cleverness — it is deletion. Every service you do not run is a service that cannot wake you up. Every dependency you skip is an upgrade you will never have to do.',
			'Boring technology, aggressively maintained, beats exciting technology, occasionally restarted. Ship the blog post instead of the Kubernetes cluster.'
		]
	}
];
