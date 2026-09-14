/// <reference lib="webworker" />

/// No-op service worker.
///
/// Purpose: satisfy Chrome/Android's installability criteria, which require a
/// registered service worker with a fetch handler before the install prompt
/// is offered. iOS Safari "Add to Home Screen" works without a service worker
/// (it relies on the manifest + apple-mobile-web-app-capable meta tags).
///
/// This worker intentionally does NOT cache anything. Analytics data must stay
/// live; caching the dashboard would risk showing stale numbers. Every fetch
/// is passed straight through to the network. If you later want app-shell
/// caching or offline support, replace the fetch handler here — but consider
/// the stale-data tradeoff for an analytics product first.

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => {
	// Activate immediately without waiting for existing clients to close.
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	// Take control of all open clients as soon as the SW activates.
	event.waitUntil(sw.clients.claim());
});

sw.addEventListener('fetch', (event) => {
	// Pass-through: never cache, never intercept. Network always wins.
	event.respondWith(fetch(event.request));
});
