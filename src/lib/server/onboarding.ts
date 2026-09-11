import type { Site } from '$lib/server/db';
import { DEMO_SITE_NAME } from '$lib/server/demo';

/** Sites the operator actually configured (excludes the auto Demo Site lab). */
export function operatorSites(sites: Site[]): Site[] {
	return sites.filter((s) => s.name !== DEMO_SITE_NAME);
}

export function needsOnboarding(sites: Site[]): boolean {
	return operatorSites(sites).length === 0;
}
