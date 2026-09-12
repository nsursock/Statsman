/**
 * Built-in tracker events (not business “custom” events).
 * Keep in sync with static/tracker.js auto instrumentation.
 */
export const AUTO_EVENT_NAMES = [
	'pageview',
	'engagement',
	'engaged_visit',
	'route_change',
	'outbound_link',
	'download',
	'scroll_25',
	'scroll_50',
	'scroll_75',
	'scroll_90'
] as const;

export type AutoEventName = (typeof AUTO_EVENT_NAMES)[number];

export const AUTO_EVENT_SQL_LIST = AUTO_EVENT_NAMES.map((n) => `'${n}'`).join(', ');
