import type { User } from '$lib/server/db';
import { getStore } from '$lib/server/db';
import { ensureFounderPlan } from '$lib/server/founder';

/** Map a verified Supabase Auth email onto Statsman `users` (keep existing site ownership). */
export async function ensureStatsmanUserFromAuth(emailRaw: string): Promise<User> {
	const email = emailRaw.trim().toLowerCase();
	if (!email || !email.includes('@')) throw new Error('Valid email required');
	const store = await getStore();
	let user = await store.upsertUserByEmail(email);
	user = await ensureFounderPlan(user);
	return user;
}
