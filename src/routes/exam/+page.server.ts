import { redirect } from '@sveltejs/kit';
import { getActiveQuestionCount } from '$lib/domains/exam/server/public';

export const load = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/');
	return {
		user: locals.user,
		isAdmin: locals.isAdmin,
		activeQuestionCount: await getActiveQuestionCount()
	};
};
export const prerender = false;
