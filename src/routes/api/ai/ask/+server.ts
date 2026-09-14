import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSite, getStats, getStatsRange } from '$lib/server/db';
import { isCloud, aiConfigured } from '$lib/server/config';
import { DEMO_SITE_NAME } from '$lib/server/demo';
import { detectInsights, buildContext, ask } from '$lib/server/ai/analyst';
import { OpenRouterError } from '$lib/server/ai/openrouter';

const DAY_MS = 24 * 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!aiConfigured()) error(503, 'AI Analyst is not configured — set OPENROUTER_API_KEY');

	const body = (await request.json().catch(() => ({}))) as {
		siteId?: string;
		question?: string;
		days?: number;
	};
	const siteId = body.siteId;
	const question = (body.question ?? '').trim();
	const days = Math.min(Math.max(Number(body.days ?? 7) || 7, 1), 90);

	if (!siteId) error(400, 'siteId is required');
	if (!question) error(400, 'question is required');
	if (question.length > 1000) error(400, 'Question too long (max 1000 chars)');

	const site = await getSite(siteId);
	if (!site) error(404, 'Unknown site');

	// Allow public access to the demo site; authenticate everything else.
	const isDemo = site.name === DEMO_SITE_NAME;
	if (!isDemo) {
		if (isCloud()) {
			if (!locals.user) error(401, 'Login required');
			if (!site.user_id || site.user_id !== locals.user.id) error(403, 'Forbidden');
		} else if (!locals.adminOk) {
			error(401, 'Admin required');
		}
	}

	const now = Date.now();
	const currentStart = now - days * DAY_MS;
	const prevStart = now - days * 2 * DAY_MS;

	const [current, previous] = await Promise.all([
		getStats(site.id, days),
		getStatsRange(site.id, prevStart, currentStart)
	]);

	const insights = detectInsights(current, previous);
	const context = buildContext(site, days, current, previous, insights);

	const ac = new AbortController();
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			try {
				for await (const delta of ask(question, context, ac.signal)) {
					controller.enqueue(encoder.encode(delta));
				}
			} catch (e) {
				const msg =
					e instanceof OpenRouterError
						? e.message
						: e instanceof Error
							? e.message
							: 'AI Analyst failed to respond';
				controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
			} finally {
				controller.close();
			}
		},
		cancel() {
			ac.abort();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no'
		}
	});
};
