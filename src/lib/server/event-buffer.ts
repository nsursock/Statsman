/**
 * In-memory event buffer: validate → enqueue → respond, then batch INSERT.
 * Cuts per-beacon Postgres RTT for analytics ingest on remote DBs.
 */
import type { EventInput } from '$lib/server/db/types';
import { getStore } from '$lib/server/db';

type Queued = {
	event: EventInput;
	/** Optional side-effects after a successful insert (e.g. usage bump). */
	after?: () => Promise<void>;
};

const queue: Queued[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

const FLUSH_MS = 40;
const FLUSH_MAX = 64;

function scheduleFlush() {
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		void flush();
	}, FLUSH_MS);
}

async function flush() {
	if (flushing) {
		scheduleFlush();
		return;
	}
	if (queue.length === 0) return;
	flushing = true;
	try {
		while (queue.length > 0) {
			const batch = queue.splice(0, FLUSH_MAX);
			const store = await getStore();
			try {
				if (typeof store.insertEvents === 'function') {
					await store.insertEvents(batch.map((b) => b.event));
				} else {
					for (const item of batch) {
						await store.insertEvent(item.event);
					}
				}
				await Promise.all(
					batch.map(async (item) => {
						if (!item.after) return;
						try {
							await item.after();
						} catch (err) {
							console.error('[statsman] post-insert hook failed', err);
						}
					})
				);
			} catch (err) {
				console.error('[statsman] event batch flush failed', err);
				// Re-queue once to avoid silent loss on transient errors.
				queue.unshift(...batch);
				scheduleFlush();
				break;
			}
		}
	} finally {
		flushing = false;
		if (queue.length > 0) scheduleFlush();
	}
}

/** Enqueue an event; returns immediately. Flushes in the background. */
export function enqueueEvent(event: EventInput, after?: () => Promise<void>) {
	queue.push({ event, after });
	if (queue.length >= FLUSH_MAX) {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
		void flush();
	} else {
		scheduleFlush();
	}
}

/** Test / shutdown helper. */
export async function flushEventBuffer() {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	await flush();
}
