import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStore, hashVisitor, currentYyyymm } from '$lib/server/db';
import { parseUserAgent } from '$lib/server/ua';
import { hostsMatch, requestHost } from '$lib/server/domain';
import { isCloud } from '$lib/server/config';
import { effectiveCloudLimits } from '$lib/server/plans';
import { geoFromHeaders, safeClientIp } from '$lib/server/geo';
import { parseDurationMs, serializeEventProps } from '$lib/server/event-props';
import { enqueueEvent } from '$lib/server/event-buffer';
import {
	ipIsExcluded,
	isDevHostname,
	siteIgnoresLocalhost
} from '$lib/server/exclusions';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, { status: 204, headers: CORS });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: Record<string, unknown>;
	try {
		const text = await request.text();
		body = JSON.parse(text) as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: CORS });
	}

	const siteId = String(body.siteId ?? '');
	const path = String(body.path ?? '/');
	const site = siteId ? await getSite(siteId) : undefined;
	if (!site) {
		return json({ ok: false, error: 'Unknown site' }, { status: 404, headers: CORS });
	}

	const host = requestHost(request);
	// When Origin/Referer present, enforce domain allowlist. Beacons without either still accept
	// (some browsers omit Origin on text/plain); path-only bots are mitigated by obscure site ids.
	if (host && !hostsMatch(site.domain, host)) {
		return new Response(null, { status: 204, headers: CORS });
	}

	// Soft-drop development traffic when the site opts into localhost ignoring (default).
	if (siteIgnoresLocalhost(site) && host && isDevHostname(host)) {
		return new Response(null, { status: 204, headers: CORS });
	}

	const eventName = body.name ? String(body.name).slice(0, 64) : 'pageview';
	const isPageview = eventName === 'pageview';

	if (isCloud() && site.user_id && isPageview) {
		const store = await getStore();
		const owner = await store.getUserById(site.user_id);
		if (owner) {
			const limits = effectiveCloudLimits(owner.plan);
			const used = await store.getMonthlyUsage(owner.id, currentYyyymm());
			if (used >= limits.pageviews) {
				// Soft drop — keep blogs green, show upgrade in dashboard.
				return new Response(null, { status: 204, headers: CORS });
			}
		}
	}

	const ua = request.headers.get('user-agent') ?? '';
	const { browser, os, device } = parseUserAgent(ua);
	const ip = safeClientIp(request, getClientAddress);

	if (ipIsExcluded(ip, site.excluded_ips)) {
		return new Response(null, { status: 204, headers: CORS });
	}

	const daySalt = new Date().toISOString().slice(0, 10);
	const geo = geoFromHeaders(request, ip);

	let referrer: string | null = body.referrer ? String(body.referrer) : null;
	if (referrer) {
		try {
			referrer = new URL(referrer).hostname;
		} catch {
			referrer = referrer.slice(0, 200);
		}
	}

	const title = body.title != null ? String(body.title).slice(0, 200) : null;
	const lang = body.lang != null ? String(body.lang).slice(0, 32) : null;
	const screen = body.screen != null ? String(body.screen).slice(0, 32) : null;
	const durationMs = parseDurationMs(body.duration);
	const props = serializeEventProps(body.data ?? body.props);

	const userId = site.user_id;
	enqueueEvent(
		{
			siteId,
			name: eventName,
			path: path.slice(0, 500),
			referrer,
			title,
			lang,
			screen,
			browser,
			os,
			device,
			country: geo.country,
			city: geo.city,
			lat: geo.lat,
			lng: geo.lng,
			durationMs,
			props,
			visitorHash: hashVisitor(ip, ua, daySalt)
		},
		isCloud() && userId && isPageview
			? async () => {
					const store = await getStore();
					await store.incrementMonthlyUsage(userId, currentYyyymm());
				}
			: undefined
	);

	// Respond immediately — insert happens in the background buffer.
	return json({ ok: true }, { headers: CORS });
};
