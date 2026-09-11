(function () {
	var s =
		document.currentScript ||
		document.querySelector('script[src*="tracker.js"][data-site]');
	if (!s) return;

	var siteId = s.getAttribute('data-site');
	if (!siteId) return;

	var endpoint =
		s.getAttribute('data-api') ||
		s.src.replace(/\/tracker\.js(?:\?.*)?$/, '/api/event');

	var started = Date.now();
	var engaged = false;

	function meta() {
		var scr = typeof window.screen === 'object' ? window.screen : null;
		var screenSize =
			scr && scr.width && scr.height ? scr.width + 'x' + scr.height : null;
		var lang =
			(navigator.languages && navigator.languages[0]) || navigator.language || null;
		var title = document.title ? String(document.title).slice(0, 200) : null;
		return {
			title: title,
			lang: lang ? String(lang).slice(0, 32) : null,
			screen: screenSize
		};
	}

	function post(payload) {
		var body = JSON.stringify(payload);
		if (typeof fetch === 'function') {
			fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain' },
				body: body,
				mode: 'cors',
				keepalive: true
			}).catch(function () {});
			return;
		}
		if (navigator.sendBeacon) {
			navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
		}
	}

	function sendPageview() {
		var m = meta();
		post({
			siteId: siteId,
			name: 'pageview',
			path: location.pathname + location.search,
			referrer: document.referrer || null,
			title: m.title,
			lang: m.lang,
			screen: m.screen
		});
	}

	function sendEngagement() {
		if (engaged) return;
		engaged = true;
		var m = meta();
		post({
			siteId: siteId,
			name: 'engagement',
			path: location.pathname + location.search,
			referrer: null,
			title: m.title,
			lang: m.lang,
			screen: m.screen,
			duration: Math.max(0, Date.now() - started)
		});
	}

	/**
	 * Custom event — Umami-style.
	 *   statsman.track('signup')
	 *   statsman.track('signup', { plan: 'indie' })
	 */
	function track(name, data) {
		if (!name) return;
		var m = meta();
		var payload = {
			siteId: siteId,
			name: String(name).slice(0, 64),
			path: location.pathname + location.search,
			referrer: document.referrer || null,
			title: m.title,
			lang: m.lang,
			screen: m.screen
		};
		if (data != null && typeof data === 'object') payload.data = data;
		post(payload);
	}

	window.statsman = { track: track };

	function onHide() {
		if (document.visibilityState === 'hidden') sendEngagement();
	}

	window.addEventListener('pagehide', sendEngagement);
	document.addEventListener('visibilitychange', onHide);

	if (document.visibilityState === 'prerender') {
		document.addEventListener('visibilitychange', function once() {
			if (document.visibilityState !== 'prerender') {
				document.removeEventListener('visibilitychange', once);
				started = Date.now();
				sendPageview();
			}
		});
	} else {
		sendPageview();
	}
})();
