/**
 * AI Analyst engine.
 *
 * Two capabilities:
 *
 *  1. Explain  — deterministic anomaly detection comparing the current period
 *     against the previous one, optionally enriched with an LLM-generated
 *     natural-language summary. No LLM is needed to detect the anomalies —
 *     the LLM only turns the facts into prose.
 *
 *  2. Ask      — the user types a question; we pre-compute a compact stats
 *     context and let the LLM interpret it. The model never sees raw event
 *     rows, only aggregated numbers.
 */

import type { StatsSummary } from '$lib/server/db/types';
import { aiConfigured } from '$lib/server/config';
import { chat, streamChat, type ChatMessage } from './openrouter';

// ── Types ──────────────────────────────────────────────────────────────

export type InsightKind =
	| 'traffic_spike'
	| 'traffic_drop'
	| 'visitor_change'
	| 'source_breakout'
	| 'page_breakout'
	| 'new_country'
	| 'engagement_change';

export type Insight = {
	kind: InsightKind;
	severity: 'info' | 'notable' | 'significant';
	title: string;
	detail: string;
	/** Numeric change vs previous period (e.g. 2.4 = +240%). `null` = new. */
	change: number | null;
};

export type ExplainResult = {
	insights: Insight[];
	summary: string | null;
	/** Whether the LLM was used to generate the summary. */
	aiPowered: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
	if (previous === 0) return current > 0 ? null : 0;
	return (current - previous) / previous;
}

function fmtPct(v: number | null): string {
	if (v === null) return 'new';
	const pct = Math.round(v * 100);
	return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// ── Anomaly detection ──────────────────────────────────────────────────

/**
 * Compare current-period stats against the previous period and return
 * structured insights. Purely deterministic — no LLM involved.
 */
export function detectInsights(
	current: StatsSummary,
	previous: StatsSummary | null
): Insight[] {
	const insights: Insight[] = [];
	if (!previous || previous.pageviews === 0) {
		// No baseline — can't compare. Still note if there's meaningful traffic.
		if (current.pageviews >= 10) {
			insights.push({
				kind: 'traffic_spike',
				severity: 'info',
				title: 'Traffic is flowing',
				detail: `${current.pageviews} pageviews from ${current.visitors} visitors — no prior period to compare against yet.`,
				change: null
			});
		}
		return insights;
	}

	// 1. Traffic volume change
	const pvChange = pctChange(current.pageviews, previous.pageviews);
	if (pvChange !== null) {
		if (pvChange >= 0.3 && current.pageviews >= 10) {
			insights.push({
				kind: 'traffic_spike',
				severity: pvChange >= 0.75 ? 'significant' : 'notable',
				title: 'Traffic spike',
				detail: `Pageviews ${fmtPct(pvChange)} vs the previous period (${previous.pageviews} → ${current.pageviews}).`,
				change: pvChange
			});
		} else if (pvChange <= -0.3 && previous.pageviews >= 10) {
			insights.push({
				kind: 'traffic_drop',
				severity: pvChange <= -0.5 ? 'significant' : 'notable',
				title: 'Traffic drop',
				detail: `Pageviews ${fmtPct(pvChange)} vs the previous period (${previous.pageviews} → ${current.pageviews}).`,
				change: pvChange
			});
		}
	}

	// 2. Visitor change
	const visChange = pctChange(current.visitors, previous.visitors);
	if (visChange !== null && Math.abs(visChange) >= 0.3 && current.visitors >= 5) {
		insights.push({
			kind: 'visitor_change',
			severity: Math.abs(visChange) >= 0.75 ? 'significant' : 'notable',
			title: visChange > 0 ? 'More visitors' : 'Fewer visitors',
			detail: `Unique visitors ${fmtPct(visChange)} (${previous.visitors} → ${current.visitors}).`,
			change: visChange
		});
	}

	// 3. Source breakouts
	const prevRef = new Map<string, number>();
	for (const r of previous.topReferrers) prevRef.set(r.referrer, r.views);
	for (const r of current.topReferrers) {
		if (r.referrer === 'Direct') continue;
		const prev = prevRef.get(r.referrer) ?? 0;
		const change = pctChange(r.views, prev);
		if (change !== null && change >= 1.0 && r.views >= 5) {
			insights.push({
				kind: 'source_breakout',
				severity: change >= 3 ? 'significant' : 'notable',
				title: `${r.referrer} traffic surging`,
				detail: `${r.referrer} sent ${r.views} visitors (${fmtPct(change)} vs ${prev} previously).`,
				change
			});
		} else if (prev === 0 && r.views >= 5) {
			insights.push({
				kind: 'source_breakout',
				severity: 'notable',
				title: `New source: ${r.referrer}`,
				detail: `${r.referrer} sent ${r.views} visitors — absent in the previous period.`,
				change: null
			});
		}
	}

	// 4. Page breakouts
	const prevPages = new Map<string, number>();
	for (const p of previous.topPages) prevPages.set(p.path, p.views);
	for (const p of current.topPages) {
		const prev = prevPages.get(p.path) ?? 0;
		const change = pctChange(p.views, prev);
		if (change !== null && change >= 1.0 && p.views >= 5) {
			insights.push({
				kind: 'page_breakout',
				severity: change >= 3 ? 'significant' : 'notable',
				title: `${p.path} is heating up`,
				detail: `${p.path} received ${p.views} views (${fmtPct(change)} vs ${prev} previously).`,
				change
			});
		}
	}

	// 5. New countries
	const prevCountries = new Set(previous.countries.map((c) => c.label));
	for (const c of current.countries) {
		if (c.label === 'Unknown') continue;
		if (!prevCountries.has(c.label) && c.views >= 3) {
			insights.push({
				kind: 'new_country',
				severity: 'info',
				title: `New audience: ${c.label}`,
				detail: `Visitors from ${c.label} (${c.views} views) — not present in the previous period.`,
				change: null
			});
		}
	}

	// 6. Engagement change
	const bounceDelta = current.bounceRate - previous.bounceRate;
	if (Math.abs(bounceDelta) >= 15 && previous.pageviews >= 10) {
		insights.push({
			kind: 'engagement_change',
			severity: Math.abs(bounceDelta) >= 25 ? 'significant' : 'notable',
			title: bounceDelta < 0 ? 'Bounce rate improved' : 'Bounce rate worsened',
			detail: `Bounce rate ${previous.bounceRate}% → ${current.bounceRate}% (${bounceDelta > 0 ? '+' : ''}${bounceDelta} pts).`,
			change: bounceDelta / 100
		});
	}

	return insights;
}

// ── Compact context for the LLM ────────────────────────────────────────

export type AnalystContext = {
	site: { name: string; domain: string };
	period: { days: number; label: string };
	current: {
		pageviews: number;
		visitors: number;
		bounceRate: number;
		avgPagesPerVisit: number;
		avgVisitDurationSec: number;
		topPages: { path: string; views: number }[];
		topReferrers: { referrer: string; views: number }[];
		countries: { label: string; views: number }[];
		devices: { device: string; views: number }[];
	};
	previous: {
		pageviews: number;
		visitors: number;
		bounceRate: number;
		topReferrers: { referrer: string; views: number }[];
		topPages: { path: string; views: number }[];
		countries: { label: string; views: number }[];
	} | null;
	insights: Insight[];
};

export function buildContext(
	site: { name: string; domain: string },
	days: number,
	current: StatsSummary,
	previous: StatsSummary | null,
	insights: Insight[]
): AnalystContext {
	return {
		site: { name: site.name, domain: site.domain },
		period: { days, label: `last ${days} days` },
		current: {
			pageviews: current.pageviews,
			visitors: current.visitors,
			bounceRate: current.bounceRate,
			avgPagesPerVisit: current.avgPagesPerVisit,
			avgVisitDurationSec: current.avgVisitDurationSec,
			topPages: current.topPages.slice(0, 8),
			topReferrers: current.topReferrers.slice(0, 8),
			countries: current.countries.slice(0, 8),
			devices: current.devices.slice(0, 5)
		},
		previous: previous
			? {
					pageviews: previous.pageviews,
					visitors: previous.visitors,
					bounceRate: previous.bounceRate,
					topReferrers: previous.topReferrers.slice(0, 8),
					topPages: previous.topPages.slice(0, 8),
					countries: previous.countries.slice(0, 8)
				}
			: null,
		insights
	};
}

// ── Explain: deterministic insights + optional LLM summary ─────────────

const EXPLAIN_SYSTEM = `You are the Statsman AI Analyst. You watch a website's analytics and explain what matters in clear, concise English.

You receive a JSON object with pre-computed statistics and a list of detected anomalies. Your job is to turn those facts into a short, human-readable summary — NOT to analyze raw data or do arithmetic.

Rules:
- Write 2-4 sentences. Never more than 5.
- Use the exact numbers provided. Never invent or round differently.
- Be direct and conversational, like a smart colleague glancing at a dashboard.
- If there are no insights, say so plainly (e.g. "Traffic is steady — nothing unusual in the last N days.").
- Don't use headers, bullet points, or markdown. Just plain sentences.
- Don't mention "the data shows" or "the analytics indicate". Just say what's happening.`;

export async function explain(
	context: AnalystContext
): Promise<ExplainResult> {
	const { insights } = context;

	if (!aiConfigured() || insights.length === 0) {
		// No LLM or no anomalies — return a deterministic fallback summary
		const fallback =
			insights.length === 0
				? `Traffic is steady — nothing unusual in the ${context.period.label}.`
				: insights
						.slice(0, 3)
						.map((i) => i.detail)
						.join(' ');
		return { insights, summary: fallback, aiPowered: false };
	}

	const messages: ChatMessage[] = [
		{ role: 'system', content: EXPLAIN_SYSTEM },
		{
			role: 'user',
			content: `Here is the analytics context for ${context.site.name} (${context.site.domain}), ${context.period.label}:\n\n${JSON.stringify(context, null, 2)}\n\nSummarize what's happening in 2-4 sentences.`
		}
	];

	try {
		const result = await chat(messages, { temperature: 0.3, maxTokens: 400 });
		return { insights, summary: result.text, aiPowered: true };
	} catch {
		// LLM failed — fall back to deterministic details
		const fallback = insights.slice(0, 3).map((i) => i.detail).join(' ');
		return { insights, summary: fallback, aiPowered: false };
	}
}

// ── Ask: streaming answer from pre-computed context ────────────────────

const ASK_SYSTEM = `You are the Statsman AI Analyst. The user asks a question about their website analytics. You receive a JSON object with pre-computed statistics — never raw event data.

Rules:
- Answer based ONLY on the provided JSON context. Never invent numbers.
- Be concise: 1-3 sentences for simple questions, up to a short paragraph for complex ones.
- If the context doesn't contain the answer, say so plainly.
- Use exact numbers from the context. Don't round or approximate differently.
- Don't use markdown formatting. Plain text only.
- If asked to compare periods, use the "current" and "previous" fields.`;

export async function* ask(
	question: string,
	context: AnalystContext,
	signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
	const messages: ChatMessage[] = [
		{ role: 'system', content: ASK_SYSTEM },
		{
			role: 'user',
			content: `Website: ${context.site.name} (${context.site.domain})\nPeriod: ${context.period.label}\n\nAnalytics context (JSON):\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`
		}
	];

	yield* streamChat(messages, { temperature: 0.3, maxTokens: 800, signal });
}
