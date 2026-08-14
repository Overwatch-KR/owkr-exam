import { count, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { questions } from '$lib/server/schema';

let activeQuestionCount: number | null = null;

export async function getActiveQuestionCount() {
	if (activeQuestionCount !== null) return activeQuestionCount;
	const [result] = await database()
		.select({ value: count() })
		.from(questions)
		.where(eq(questions.active, true));
	activeQuestionCount = result.value;
	return activeQuestionCount;
}

export function invalidateExamConfig() {
	activeQuestionCount = null;
}
