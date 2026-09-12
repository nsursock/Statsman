export type PlanId = 'free' | 'indie' | 'creator' | 'selfhost';

export type User = {
	id: string;
	email: string;
	plan: PlanId | string;
	stripe_customer_id: string | null;
	created_at: number;
};

export type Session = {
	id: string;
	user_id: string;
	token_hash: string;
	expires_at: number;
};

export type Site = {
	id: string;
	user_id: string | null;
	name: string;
	domain: string;
	created_at: number;
};

export type EventInput = {
	siteId: string;
	name?: string;
	path: string;
	referrer?: string | null;
	title?: string | null;
	lang?: string | null;
	screen?: string | null;
	browser?: string | null;
	os?: string | null;
	device?: string | null;
	country?: string | null;
	city?: string | null;
	lat?: number | null;
	lng?: number | null;
	durationMs?: number | null;
	props?: string | null;
	visitorHash: string;
	/** Override insert time (demo seeding). Defaults to Date.now(). */
	createdAt?: number;
};

export type RecentEvent = {
	id: number | string;
	name: string;
	path: string;
	referrer: string | null;
	title: string | null;
	browser: string | null;
	os: string | null;
	device: string | null;
	country: string | null;
	city: string | null;
	created_at: number;
};

export type RankStat = { label: string; views: number };

export type GeoCityStat = {
	city: string;
	country: string;
	lat: number;
	lng: number;
	views: number;
};

export type StatsSummary = {
	pageviews: number;
	visitors: number;
	bounceRate: number;
	avgPagesPerVisit: number;
	/** Average engagement duration in seconds (from heartbeat events). */
	avgVisitDurationSec: number;
	topPages: { path: string; views: number }[];
	topReferrers: { referrer: string; views: number }[];
	browsers: { browser: string; views: number }[];
	operatingSystems: { os: string; views: number }[];
	devices: { device: string; views: number }[];
	languages: RankStat[];
	screens: RankStat[];
	utmSources: RankStat[];
	utmMediums: RankStat[];
	campaigns: RankStat[];
	countries: RankStat[];
	cities: GeoCityStat[];
	/** Ranked event names excluding pageview/engagement (auto + custom). */
	customEvents: RankStat[];
	timeseries: { date: string; pageviews: number; visitors: number }[];
};

export type Usage = {
	user_id: string;
	yyyymm: string;
	pageviews: number;
};

export type Store = {
	listSites(userId?: string | null): Promise<Site[]>;
	getSite(id: string): Promise<Site | undefined>;
	createSite(name: string, domain: string, userId?: string | null): Promise<Site>;
	deleteSite(id: string): Promise<boolean>;
	countSitesForUser(userId: string): Promise<number>;
	insertEvent(event: EventInput): Promise<void>;
	getStats(siteId: string, days?: number, points?: number): Promise<StatsSummary>;
	getRecentEvents(siteId: string, limit?: number): Promise<RecentEvent[]>;
	siteHasEvents(siteId: string): Promise<boolean>;

	getUserById(id: string): Promise<User | undefined>;
	getUserByEmail(email: string): Promise<User | undefined>;
	upsertUserByEmail(email: string): Promise<User>;
	setUserPlan(userId: string, plan: string): Promise<void>;
	setStripeCustomerId(userId: string, customerId: string): Promise<void>;
	getUserByStripeCustomer(customerId: string): Promise<User | undefined>;

	createLoginToken(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
	consumeLoginToken(tokenHash: string): Promise<string | undefined>;
	createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
	getSessionUser(tokenHash: string): Promise<User | undefined>;
	deleteSession(tokenHash: string): Promise<void>;

	getMonthlyUsage(userId: string, yyyymm: string): Promise<number>;
	incrementMonthlyUsage(userId: string, yyyymm: string, by?: number): Promise<number>;
};
