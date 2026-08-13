import { redirect } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { questions } from '$lib/server/schema';

export const load = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/');
	const [activeQuestionCount] = await database()
		.select({ value: count() })
		.from(questions)
		.where(eq(questions.active, true));
	return {
		user: locals.user,
		isAdmin: locals.isAdmin,
		activeQuestionCount: activeQuestionCount.value
	};
};
export const prerender = false;
