import type { Handle } from '@sveltejs/kit';
import { isCloud } from '$lib/server/config';
import { adminAuthorized, readSessionUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const user = await readSessionUser(event.cookies);
	event.locals.user = user;
	event.locals.isCloud = isCloud();
	event.locals.adminOk = adminAuthorized(event.cookies, event.request);
	return resolve(event);
};
