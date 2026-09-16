import Database from 'better-sqlite3';
import path from 'node:path';
import { SITE_CT, SITE_TIL, STATSMAN_URL } from './helpers/ports';

export default async function globalSetup() {
	const health = await fetch(`${STATSMAN_URL}/api/health`);
	if (!health.ok) throw new Error(`Statsman selfhost health check failed: ${health.status}`);
	const unlock = await fetch(`${STATSMAN_URL}/api/auth/login`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openAccess: true })
	});
	const cookie = unlock.headers.get('set-cookie')?.split(';')[0];
	await fetch(`${STATSMAN_URL}/api/sites`, { headers: cookie ? { Cookie: cookie } : {} });
	const db = new Database(path.resolve('.e2e/selfhost.db'));
	const insert = db.prepare(`INSERT OR IGNORE INTO sites
		(id, user_id, name, domain, created_at, excluded_ips, ignore_localhost)
		VALUES (?, NULL, ?, 'localhost', ?, '[]', 0)`);
	insert.run(SITE_CT, 'Come & Terry (e2e)', Date.now());
	insert.run(SITE_TIL, 'TIL Blog (e2e)', Date.now());
	db.close();
}
