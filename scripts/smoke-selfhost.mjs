#!/usr/bin/env node
/**
 * Local self-host smoke (operator console — no Stripe / SaaS password auth).
 * Expects a running instance with STATSMAN_MODE=selfhost (or hosted).
 *
 *   STATSMAN_MODE=selfhost DATABASE_PATH=./data/smoke-selfhost.db \
 *     PUBLIC_ORIGIN=http://localhost:5174 npm run dev -- --port 5174
 *   SMOKE_BASE=http://localhost:5174 node scripts/smoke-selfhost.mjs
 */
const BASE = process.env.SMOKE_BASE || 'http://localhost:5174';

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function cookieFrom(res) {
	const raw = res.headers.getSetCookie?.() || [];
	const list = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
	const jar = {};
	for (const c of list) {
		const [pair] = c.split(';');
		const i = pair.indexOf('=');
		if (i > 0) jar[pair.slice(0, i)] = pair.slice(i + 1);
	}
	return jar;
}

function jarHeader(jar) {
	return Object.entries(jar)
		.map(([k, v]) => `${k}=${v}`)
		.join('; ');
}

async function run() {
	const results = [];
	console.log(`Self-host smoke → ${BASE}`);

	const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
	assert(health.ok, 'health not ok');
	assert(health.mode === 'selfhost' || health.mode === 'hosted', `expected selfhost/hosted, got ${health.mode}`);
	results.push(`mode=${health.mode} db=${health.db}`);

	const cloudLogin = await fetch(`${BASE}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'should-fail@example.com', password: 'x' })
	});
	assert(cloudLogin.status >= 400, `cloud password login should fail on selfhost, got ${cloudLogin.status}`);
	results.push('cloud password login rejected');

	const unlock = await fetch(`${BASE}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ openAccess: true })
	});
	const unlockBody = await unlock.json().catch(() => ({}));
	if (unlock.status === 400 && /ADMIN_TOKEN/i.test(String(unlockBody.message || ''))) {
		assert(false, 'ADMIN_TOKEN is set — unset it for this smoke or extend script to use the token');
	}
	assert(unlock.ok && unlockBody.mode === 'open', `open unlock failed: ${unlock.status} ${JSON.stringify(unlockBody)}`);
	const jar = cookieFrom(unlock);
	const cookie = jarHeader(jar);
	assert(cookie.includes('statsman_access') || cookie.length > 0, 'missing access cookie');
	results.push('open console unlock ok');

	const stamp = Date.now().toString(36);
	const create = await fetch(`${BASE}/api/sites`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: `Selfhost ${stamp}`, domain: `selfhost-${stamp}.example.com` })
	});
	const created = await create.json();
	assert(create.status === 201 && created.site?.id, `create site: ${create.status}`);
	const site = created.site;
	results.push(`site ${site.id}`);

	await fetch(`${BASE}/api/sites/${site.id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ ignore_localhost: false })
	});

	for (let i = 0; i < 5; i++) {
		const ev = await fetch(`${BASE}/api/event`, {
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain',
				Origin: `https://${site.domain}`,
				Referer: `https://${site.domain}/p/${i}`
			},
			body: JSON.stringify({ siteId: site.id, path: `/p/${i}`, name: 'pageview' })
		});
		assert(ev.status === 200 || ev.status === 204, `event ${ev.status}`);
	}
	await new Promise((r) => setTimeout(r, 600));

	const stats = await fetch(`${BASE}/api/stats?siteId=${site.id}&days=7`, {
		headers: { Cookie: cookie }
	}).then(async (r) => ({ status: r.status, json: await r.json() }));
	assert(stats.status === 200, `stats ${stats.status}`);
	const views = stats.json.stats?.pageviews;
	assert(views >= 5, `expected >=5 pageviews, got ${views}`);
	results.push(`pageviews=${views} (no cloud cap)`);

	for (const path of ['/billing', '/subscribe?plan=indie', '/pricing']) {
		const res = await fetch(`${BASE}${path}`, { redirect: 'manual', headers: { Cookie: cookie } });
		// selfhost: marketing off → redirect away from pricing too; billing/subscribe redirect
		assert(
			res.status === 303 || res.status === 302 || res.status === 200,
			`${path} unexpected ${res.status}`
		);
		if (path.startsWith('/billing') || path.startsWith('/subscribe')) {
			assert([302, 303].includes(res.status), `${path} should redirect on non-cloud, got ${res.status}`);
		}
		results.push(`${path} → ${res.status}`);
	}

	const bill = await fetch(`${BASE}/api/billing/subscribe`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ plan: 'indie' })
	});
	assert(bill.status >= 400, `subscribe should be cloud-only, got ${bill.status}`);
	results.push('billing API rejected');

	console.log('\nPASS (selfhost)');
	for (const line of results) console.log(' •', line);
}

run().catch((err) => {
	console.error('\nFAIL:', err.message);
	process.exit(1);
});
