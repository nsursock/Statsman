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
	var engagedVisit = false;
	var scrolled = false;
	var scrollMarks = { 25: false, 50: false, 75: false, 90: false };
	var lastPath = location.pathname + location.search;

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

	function emit(name, data, opts) {
		opts = opts || {};
		var m = meta();
		var payload = {
			siteId: siteId,
			name: String(name).slice(0, 64),
			path: location.pathname + location.search,
			referrer: opts.referrer === undefined ? document.referrer || null : opts.referrer,
			title: m.title,
			lang: m.lang,
			screen: m.screen
		};
		if (opts.duration != null) payload.duration = opts.duration;
		if (data != null && typeof data === 'object') payload.data = data;
		post(payload);
	}

	function sendPageview() {
		emit('pageview', null, { referrer: document.referrer || null });
	}

	function maybeEngagedVisit() {
		if (engagedVisit) return;
		var dwell = Date.now() - started;
		if (dwell < 10000 && !scrolled) return;
		engagedVisit = true;
		emit('engaged_visit', { dwell_ms: dwell, scrolled: scrolled }, { referrer: null });
	}

	function sendEngagement() {
		if (engaged) return;
		engaged = true;
		maybeEngagedVisit();
		emit(
			'engagement',
			null,
			{ referrer: null, duration: Math.max(0, Date.now() - started) }
		);
	}

	/**
	 * Custom / business event — never auto-fired.
	 *   statsman.track('signup')
	 *   statsman.track('signup', { plan: 'indie' })
	 * Do not put passwords, emails, or form field values in data.
	 */
	function track(name, data) {
		if (!name) return;
		emit(name, data);
	}

	window.statsman = { track: track };

	/* —— SPA route changes —— */
	function onRouteChange() {
		var next = location.pathname + location.search;
		if (next === lastPath) return;
		var from = lastPath;
		lastPath = next;
		started = Date.now();
		engaged = false;
		engagedVisit = false;
		scrolled = false;
		scrollMarks = { 25: false, 50: false, 75: false, 90: false };
		emit('route_change', { from: from }, { referrer: null });
		sendPageview();
	}

	var _push = history.pushState;
	var _replace = history.replaceState;
	history.pushState = function () {
		var r = _push.apply(this, arguments);
		onRouteChange();
		return r;
	};
	history.replaceState = function () {
		var r = _replace.apply(this, arguments);
		onRouteChange();
		return r;
	};
	window.addEventListener('popstate', onRouteChange);

	/* —— Scroll milestones (once per page) —— */
	function onScroll() {
		var el = document.documentElement;
		var body = document.body;
		var scrollTop = window.scrollY || el.scrollTop || 0;
		var height = Math.max(el.scrollHeight, body ? body.scrollHeight : 0);
		var view = window.innerHeight || el.clientHeight;
		var max = Math.max(1, height - view);
		var pct = Math.min(100, Math.round((scrollTop / max) * 100));
		if (pct >= 25) scrolled = true;
		[25, 50, 75, 90].forEach(function (mark) {
			if (pct >= mark && !scrollMarks[mark]) {
				scrollMarks[mark] = true;
				emit('scroll_' + mark, { percent: mark }, { referrer: null });
			}
		});
		if (scrollMarks[90]) maybeEngagedVisit();
	}

	var scrollTick = false;
	window.addEventListener(
		'scroll',
		function () {
			if (scrollTick) return;
			scrollTick = true;
			requestAnimationFrame(function () {
				scrollTick = false;
				onScroll();
			});
		},
		{ passive: true }
	);

	/* —— Outbound links + downloads —— */
	function fileName(href) {
		try {
			var u = new URL(href, location.href);
			var parts = u.pathname.split('/');
			return parts[parts.length - 1] || u.pathname;
		} catch (e) {
			return null;
		}
	}

	function isDownload(a, href) {
		if (a.hasAttribute('download')) return true;
		return /\.(pdf|zip|gz|tgz|rar|7z|csv|xlsx?|docx?|pptx?|dmg|pkg|exe|mp3|mp4|wav|mov)(\?|#|$)/i.test(
			href
		);
	}

	document.addEventListener(
		'click',
		function (e) {
			var node = e.target;
			while (node && node.tagName !== 'A') node = node.parentElement;
			if (!node || !node.href) return;
			var href = node.href;
			var file = fileName(href);
			if (isDownload(node, href)) {
				emit('download', { file: file ? String(file).slice(0, 200) : null, href: href.slice(0, 300) });
				return;
			}
			try {
				var u = new URL(href);
				if (u.host && u.host !== location.host) {
					emit('outbound_link', {
						host: u.hostname.slice(0, 200),
						href: href.slice(0, 300)
					});
				}
			} catch (err) {
				/* ignore */
			}
		},
		true
	);

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
