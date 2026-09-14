export type SettingsTab = 'sites' | 'tracker' | 'appearance' | 'demo' | 'account';

export type Site = {
	id: string;
	name: string;
	domain: string;
	excluded_ips?: string | string[];
	ignore_localhost?: boolean;
};

export type Usage = {
	used: number;
	limit: number;
	sitesLimit: number;
	sitesUsed: number;
	plan: string;
	pct: number;
	overCap: boolean;
} | null;

export type TrackingPatch = {
	ignore_localhost?: boolean;
	excluded_ips?: string[];
};
