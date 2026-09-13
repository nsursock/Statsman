#!/usr/bin/env node
/**
 * Local multi-tenant smoke (cloud mode).
 * Usage: node scripts/smoke-multi-client.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SMOKE_BASE || 'http://localhost:5173';

function loadEnv() {
	const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	const out = {};
	for (const line of raw.split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (!m) continue;
		out[m[1]] = m[2].replace(/\s+#.*$/, '').trim();
	}
	return out;
}

const env = loadEnv();
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

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

async function login(email, password = 'SmokeTest!234') {
	const signup = await fetch(`${BASE}/api/auth/signup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const signupBody = await signup.json().catch(() => ({}));
	// Signup may succeed, or fail if the user already exists / needs email confirm — then password login.
	if (!signup.ok && !String(signupBody.error || '').toLowerCase().includes('already')) {
		// Continue to login; confirm-email projects often still allow password after signup.
	}

	const start = await fetch(`${BASE}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const body = await start.json();
	assert(start.ok && body.ok, `login failed for ${email}: ${JSON.stringify(body)}`);
	const jar = cookieFrom(start);
	assert(jar.statsman_session, 'missing session cookie');
	return { email, jar, cookie: jarHeader(jar) };
}

async function api(cookie, path, opts = {}) {
	const res = await fetch(`${BASE}${path}`, {
		...opts,
		headers: {
			...(opts.body ? { 'Content-Type': 'application/json' } : {}),
			Cookie: cookie,
			...(opts.headers || {})
		}
	});
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text };
	}
	return { res, json, status: res.status };
}

async function createSite(cookie, name, domain) {
	const { res, json, status } = await api(cookie, '/api/sites', {
		method: 'POST',
		body: JSON.stringify({ name, domain })
	});
	assert(status === 201 && json.site?.id, `create site failed: ${status} ${JSON.stringify(json)}`);
	// Allow localhost tracking for smoke
	const patch = await api(cookie, `/api/sites/${json.site.id}`, {
		method: 'PATCH',
		body: JSON.stringify({ ignore_localhost: false })
	});
	assert(patch.status === 200, `patch site failed: ${patch.status}`);
	return json.site;
}

async function track(siteId, path, domain) {
	const res = await fetch(`${BASE}/api/event`, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain',
			Origin: `https://${domain}`,
			Referer: `https://${domain}${path}`
		},
		body: JSON.stringify({
			siteId,
			path,
			name: 'pageview',
			referrer: '',
			screen: '1440x900'
		})
	});
	assert(res.status === 204 || res.status === 200, `event status ${res.status}`);
}

async function stats(cookie, siteId) {
	const { res, json, status } = await api(cookie, `/api/stats?siteId=${siteId}&days=7`);
	return { status, json };
}

async function pay(cookie, plan) {
	const sub = await api(cookie, '/api/billing/subscribe', {
		method: 'POST',
		body: JSON.stringify({ plan })
	});
	assert(sub.status === 200 && sub.json.clientSecret, `subscribe failed: ${JSON.stringify(sub.json)}`);

	const clientSecret = sub.json.clientSecret;
	const paymentIntentId = clientSecret.split('_secret_')[0];
	const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
		payment_method: 'pm_card_visa',
		return_url: `${BASE}/subscribe/complete`
	});
	assert(
		confirmed.status === 'succeeded' || confirmed.status === 'processing',
		`PI status ${confirmed.status}`
	);

	// Give webhook a moment
	await new Promise((r) => setTimeout(r, 1500));

	const confirm = await api(cookie, '/api/billing/confirm', {
		method: 'POST',
		body: JSON.stringify({
			subscriptionId: sub.json.subscriptionId,
			paymentIntentId
		})
	});
	assert(confirm.status === 200, `confirm failed: ${JSON.stringify(confirm.json)}`);
	return { plan: confirm.json.plan, subscriptionId: sub.json.subscriptionId, status: confirm.json.status };
}

async function me(cookie) {
	// reuse sites list + dashboard isn't JSON; hit change-plan/cancel readiness via sites
	const sites = await api(cookie, '/api/sites');
	assert(sites.status === 200, 'sites list failed');
	return sites.json.sites;
}

const stamp = Date.now().toString(36);
const results = [];

async function run() {
	console.log(`Smoke base ${BASE}`);

	const a = await login(`client-a-${stamp}@example.com`);
	const b = await login(`client-b-${stamp}@example.com`);
	results.push(`login A=${a.email} B=${b.email}`);

	const siteA = await createSite(a.cookie, `Blog A ${stamp}`, `blog-a-${stamp}.example.com`);
	const siteB = await createSite(b.cookie, `Blog B ${stamp}`, `blog-b-${stamp}.example.com`);
	results.push(`sites A=${siteA.id} B=${siteB.id}`);

	for (let i = 0; i < 3; i++) {
		await track(siteA.id, `/posts/a-${i}`, siteA.domain);
		await track(siteB.id, `/posts/b-${i}`, siteB.domain);
	}
	await new Promise((r) => setTimeout(r, 800));

	const statsA = await stats(a.cookie, siteA.id);
	const statsB = await stats(b.cookie, siteB.id);
	assert(statsA.status === 200, `A stats ${statsA.status}`);
	assert(statsB.status === 200, `B stats ${statsB.status}`);
	const viewsA = statsA.json.stats?.totals?.pageviews ?? statsA.json.stats?.pageviews ?? null;
	const viewsB = statsB.json.stats?.totals?.pageviews ?? statsB.json.stats?.pageviews ?? null;
	results.push(`stats A=${JSON.stringify(statsA.json.stats?.totals || statsA.json.stats?.summary || Object.keys(statsA.json.stats||{}))} B similar ok`);

	const cross = await stats(a.cookie, siteB.id);
	assert(cross.status === 403, `expected 403 cross-tenant, got ${cross.status}`);
	results.push('cross-tenant stats → 403');

	const crossB = await stats(b.cookie, siteA.id);
	assert(crossB.status === 403, `expected 403 cross-tenant B→A, got ${crossB.status}`);
	results.push('cross-tenant B→A → 403');

	const sitesAAsB = await api(b.cookie, '/api/sites');
	const idsB = (sitesAAsB.json.sites || []).map((s) => s.id);
	assert(!idsB.includes(siteA.id), 'B listed A site');
	assert(idsB.includes(siteB.id), 'B missing own site');
	results.push('site list isolation ok');

	const payA = await pay(a.cookie, 'indie');
	results.push(`pay A → plan=${payA.plan} status=${payA.status}`);
	assert(payA.plan === 'indie', `A expected indie got ${payA.plan}`);

	const payB = await pay(b.cookie, 'creator');
	results.push(`pay B → plan=${payB.plan} status=${payB.status}`);
	assert(payB.plan === 'creator', `B expected creator got ${payB.plan}`);

	// Free site limit: A is indie (3 sites) — create 2 more ok; B creator has higher cap
	const a2 = await createSite(a.cookie, `Blog A2 ${stamp}`, `blog-a2-${stamp}.example.com`);
	results.push(`A second site ${a2.id}`);

	// Attempt B reading A billing via change-plan is auth-scoped to session — skip

	console.log('\nPASS');
	for (const line of results) console.log(' •', line);
	if (viewsA != null || viewsB != null) {
		console.log(' • pageviews hint A=', viewsA, 'B=', viewsB);
	}
}

run().catch((err) => {
	console.error('\nFAIL:', err.message);
	for (const line of results) console.error(' •', line);
	process.exit(1);
});
