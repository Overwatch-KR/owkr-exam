import type { Handle } from '@sveltejs/kit';
import { getSession, isAdmin, isLocalAuthRequest, localAdminUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const localAuth = isLocalAuthRequest(event.url);
	event.locals.user = localAuth ? localAdminUser : getSession(event.cookies);
	event.locals.isAdmin = localAuth || (!!event.locals.user && isAdmin(event.locals.user.id));
	const response = await resolve(event);
	if (
		event.url.pathname.startsWith('/exam') ||
		event.url.pathname.startsWith('/admin') ||
		event.url.pathname.startsWith('/api/exam')
	)
		response.headers.set('Cache-Control', 'no-store, private');
	return response;
};
