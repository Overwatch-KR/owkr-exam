import { redirect } from '@sveltejs/kit';
import { getActiveExamSummary } from '$lib/domains/exam/server/public';

export const load = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/');
	return {
		user: locals.user,
		isAdmin: locals.isAdmin,
		examSummary: await getActiveExamSummary()
	};
};
export const prerender = false;
