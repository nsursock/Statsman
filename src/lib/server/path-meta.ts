/** Path / campaign helpers derived from tracker `path` (pathname + search). */

export type RankRow = { label: string; views: number };

function rankMap(map: Map<string, number>, limit: number): RankRow[] {
	return [...map.entries()]
		.map(([label, views]) => ({ label, views }))
		.sort((a, b) => b.views - a.views)
		.slice(0, limit);
}

/**
 * Collapse raw `path` groups into clean page paths + UTM / campaign ranks.
 * Tracker already sends `pathname + search`; no schema change required for campaigns.
 */
export function aggregatePathMeta(
	rows: { path: string; views: number }[],
	limit = 10
): {
	topPages: { path: string; views: number }[];
	campaigns: RankRow[];
	utmSources: RankRow[];
	utmMediums: RankRow[];
} {
	const pages = new Map<string, number>();
	const campaigns = new Map<string, number>();
	const sources = new Map<string, number>();
	const mediums = new Map<string, number>();

	for (const row of rows) {
		const qIdx = row.path.indexOf('?');
		const pathname = (qIdx >= 0 ? row.path.slice(0, qIdx) : row.path) || '/';
		pages.set(pathname, (pages.get(pathname) ?? 0) + row.views);

		if (qIdx < 0) continue;
		let params: URLSearchParams;
		try {
			params = new URLSearchParams(row.path.slice(qIdx + 1));
		} catch {
			continue;
		}

		const source = params.get('utm_source') || params.get('ref') || params.get('source');
		const medium = params.get('utm_medium');
		const campaign = params.get('utm_campaign');

		if (source) sources.set(source, (sources.get(source) ?? 0) + row.views);
		if (medium) mediums.set(medium, (mediums.get(medium) ?? 0) + row.views);
		if (campaign) campaigns.set(campaign, (campaigns.get(campaign) ?? 0) + row.views);
	}

	return {
		topPages: rankMap(pages, limit).map((r) => ({ path: r.label, views: r.views })),
		campaigns: rankMap(campaigns, limit),
		utmSources: rankMap(sources, limit),
		utmMediums: rankMap(mediums, limit)
	};
}
