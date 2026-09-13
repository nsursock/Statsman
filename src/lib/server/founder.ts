import { isFounderEmail } from '$lib/server/config';
import { getStore } from '$lib/server/db';
import type { User } from '$lib/server/db';

/** Ensure cloud operator emails stay on Founder (never Free). */
export async function ensureFounderPlan(user: User): Promise<User> {
	if (!isFounderEmail(user.email)) return user;
	if (user.plan === 'founder') return user;
	const store = await getStore();
	await store.setUserPlan(user.id, 'founder');
	return { ...user, plan: 'founder' };
}
