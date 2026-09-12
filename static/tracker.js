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

	var OPTOUT_KEY = 'statsman_optout';
	var optedOut = false;

	function readCookie(name) {
		try {
			var parts = (document.cookie || '').split(';');
			for (var i = 0; i < parts.length; i++) {
				var p = parts[i].trim();
				if (p.indexOf(name + '=') === 0) return decodeURIComponent(p.slice(name.length + 1));
			}
		} catch (e) {
			/* ignore */
		}
		return null;
	}

	function writeCookie(name, value, days) {
		try {
			var maxAge = Math.floor((days || 3650) * 86400);
			document.cookie =
				name +
				'=' +
				encodeURIComponent(value) +
				';path=/;max-age=' +
				maxAge +
				';SameSite=Lax';
		} catch (e) {
			/* ignore */
		}
	}

	function clearCookie(name) {
		try {
			document.cookie = name + '=;path=/;max-age=0;SameSite=Lax';
		} catch (e) {
			/* ignore */
		}
	}

	function storageGet(key) {
		try {
			return localStorage.getItem(key);
		} catch (e) {
			return null;
		}
	}

	function storageSet(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch (e) {
			/* ignore */
		}
	}

	function storageRemove(key) {
		try {
			localStorage.removeItem(key);
		} catch (e) {
			/* ignore */
		}
	}

	function isOptedOut() {
		if (optedOut) return true;
		if (storageGet(OPTOUT_KEY) === 'true') return true;
		if (readCookie(OPTOUT_KEY) === 'true') return true;
		return false;
	}

	function disableTracking() {
		optedOut = true;
		storageSet(OPTOUT_KEY, 'true');
		writeCookie(OPTOUT_KEY, 'true');
	}

	function enableTracking() {
		optedOut = false;
		storageRemove(OPTOUT_KEY);
		clearCookie(OPTOUT_KEY);
	}

	function isDevHost() {
		var h = (location.hostname || '').toLowerCase();
		if (!h) return false;
		if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h === '::1') {
			return true;
		}
		return h.slice(-6) === '.local';
	}

	var allowLocalhost =
		s.hasAttribute('data-allow-localhost') &&
		s.getAttribute('data-allow-localhost') !== 'false' &&
		s.getAttribute('data-allow-localhost') !== '0';

	// ?statsman_debug=1 → persistent browser opt-out (Preview site / admin debug)
	try {
		if (/(?:^|[?&])statsman_debug=1(?:&|$)/.test(location.search || '')) {
			disableTracking();
		}
	} catch (e) {
		/* ignore */
	}

	if (isOptedOut()) {
		window.statsman = {
			track: function () {},
			disableTracking: disableTracking,
			enableTracking: enableTracking,
			isOptedOut: function () {
				return true;
			}
		};
		return;
	}

	// Development hosts are ignored unless the snippet opts in (demo lab).
	if (isDevHost() && !allowLocalhost) {
		window.statsman = {
			track: function () {},
			disableTracking: disableTracking,
			enableTracking: enableTracking,
			isOptedOut: isOptedOut
		};
		return;
	}

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
		if (isOptedOut()) return;
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
		if (isOptedOut()) return;
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

	window.statsman = {
		track: track,
		disableTracking: disableTracking,
		enableTracking: enableTracking,
		isOptedOut: isOptedOut
	};

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
