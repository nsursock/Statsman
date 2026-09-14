/**
 * OpenRouter client for the Statsman AI Analyst.
 *
 * Two modes:
 *  - `chat()`      — non-streaming, returns the full response text. Used by the
 *                    Explain feature where we want a short, structured summary.
 *  - `streamChat()` — async generator yielding text deltas as they arrive. Used
 *                    by the Ask feature for a real-time chat UX.
 *
 * The client reads config from env vars via $lib/server/config so callers don't
 * need to pass keys around. SSE parsing follows the OpenRouter streaming spec:
 * skip `:` comment lines, handle mid-stream `error` fields, and collect the
 * final usage chunk before `[DONE]`.
 */

import {
	getOpenRouterApiKey,
	getOpenRouterModel,
	getOpenRouterBaseUrl,
	getPublicOrigin
} from '$lib/server/config';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

export type ChatResult = {
	text: string;
	model: string;
	usage?: { promptTokens: number; completionTokens: number };
};

export class OpenRouterError extends Error {
	readonly status: number;
	readonly code: string;
	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = 'OpenRouterError';
		this.status = status;
		this.code = code;
	}
}

function authHeaders(): Record<string, string> {
	const key = getOpenRouterApiKey();
	if (!key) throw new OpenRouterError('OPENROUTER_API_KEY is not configured', 401, 'missing_key');
	return {
		Authorization: `Bearer ${key}`,
		'Content-Type': 'application/json',
		'HTTP-Referer': getPublicOrigin(),
		'X-Title': 'Statsman AI Analyst'
	};
}

function classifyError(status: number, msg: string): OpenRouterError {
	if (status === 401) return new OpenRouterError('OpenRouter rejected the API key', status, 'auth');
	if (status === 402)
		return new OpenRouterError('OpenRouter credits exhausted — add credits at openrouter.ai/credits', status, 'credits');
	if (status === 429)
		return new OpenRouterError('OpenRouter rate limit — retry shortly', status, 'rate_limit');
	return new OpenRouterError(`OpenRouter ${status}: ${msg.slice(0, 300)}`, status, 'api_error');
}

/**
 * Strip OpenRouter safety/moderation annotations that some models append
 * to the response content (e.g. "User Safety: safe", "Safety: safe").
 * These are metadata, not part of the answer the user needs to see.
 */
const SAFETY_RE = /(?:User\s*)?Safety\s*:\s*\w+\s*\.?$/i;

/** Strip safety annotation from a complete response. Safe to trim. */
function stripSafety(text: string): string {
	return text.replace(SAFETY_RE, '').trim();
}

/**
 * Strip safety annotation from a streaming delta WITHOUT trimming —
 * trimming individual chunks would eat the spaces between words.
 */
function stripSafetyDelta(text: string): string {
	return text.replace(SAFETY_RE, '');
}

/** Non-streaming chat completion. Returns the full text. */
export async function chat(
	messages: ChatMessage[],
	opts?: { temperature?: number; maxTokens?: number; model?: string; signal?: AbortSignal }
): Promise<ChatResult> {
	const model = opts?.model ?? getOpenRouterModel();
	const body: Record<string, unknown> = {
		model,
		messages,
		temperature: opts?.temperature ?? 0.4,
		max_tokens: opts?.maxTokens ?? 1024
	};

	const res = await fetch(`${getOpenRouterBaseUrl()}/chat/completions`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(body),
		signal: opts?.signal
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		let msg = text;
		try {
			const j = JSON.parse(text);
			msg = j?.error?.message ?? text;
		} catch {
			/* keep raw text */
		}
		throw classifyError(res.status, msg);
	}

	const data = (await res.json()) as {
		model?: string;
		choices?: { message?: { content?: string | null } }[];
		usage?: { prompt_tokens?: number; completion_tokens?: number };
	};

	const content = stripSafety(data.choices?.[0]?.message?.content?.trim() ?? '');
	if (!content) throw new OpenRouterError('OpenRouter returned an empty completion', 200, 'empty');

	return {
		text: content,
		model: data.model ?? model,
		usage: data.usage
			? {
					promptTokens: data.usage.prompt_tokens ?? 0,
					completionTokens: data.usage.completion_tokens ?? 0
				}
			: undefined
	};
}

/**
 * Streaming chat completion. Yields text deltas as they arrive.
 * Handles SSE comments, mid-stream errors, and the terminal usage chunk.
 */
export async function* streamChat(
	messages: ChatMessage[],
	opts?: { temperature?: number; maxTokens?: number; model?: string; signal?: AbortSignal }
): AsyncGenerator<string, void, unknown> {
	const model = opts?.model ?? getOpenRouterModel();
	const body: Record<string, unknown> = {
		model,
		messages,
		stream: true,
		stream_options: { include_usage: true },
		temperature: opts?.temperature ?? 0.4,
		max_tokens: opts?.maxTokens ?? 1024
	};

	const res = await fetch(`${getOpenRouterBaseUrl()}/chat/completions`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(body),
		signal: opts?.signal
	});

	if (!res.ok || !res.body) {
		const text = await res.text().catch(() => '');
		let msg = text;
		try {
			const j = JSON.parse(text);
			msg = j?.error?.message ?? text;
		} catch {
			/* keep raw text */
		}
		throw classifyError(res.status, msg);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });

			while (true) {
				const nl = buf.indexOf('\n');
				if (nl === -1) break;
				const line = buf.slice(0, nl).trim();
				buf = buf.slice(nl + 1);

				// Skip SSE comments (": OPENROUTER PROCESSING" keep-alive)
				if (line.startsWith(':') || !line) continue;

				if (!line.startsWith('data:')) continue;
				const payload = line.slice(5).trim();
				if (payload === '[DONE]') return;

				let chunk: {
					choices?: { delta?: { content?: string }; finish_reason?: string }[];
					error?: { message?: string };
				};
				try {
					chunk = JSON.parse(payload);
				} catch {
					continue;
				}

				// Mid-stream error
				if (chunk.error?.message) {
					throw new OpenRouterError(chunk.error.message, 200, 'stream_error');
				}

				const content = chunk.choices?.[0]?.delta?.content;
				if (content) {
					const cleaned = stripSafetyDelta(content);
					if (cleaned) yield cleaned;
				}
			}
		}
	} finally {
		reader.cancel().catch(() => {});
	}
}
