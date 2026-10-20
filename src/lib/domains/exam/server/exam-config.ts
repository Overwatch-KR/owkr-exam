import { count, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { questions } from '$lib/server/schema';

export async function getActiveExamSummary() {
	const rows = await database()
		.select({ type: questions.type, points: questions.points, sortOrder: questions.sortOrder })
		.from(questions)
		.where(eq(questions.active, true))
		.orderBy(questions.sortOrder);
	const lastEssay = rows.filter((question) => question.type === 'essay').at(-1);
	return [
		{ label: '객관식', rows: rows.filter((question) => question.type === 'multiple') },
		{ label: '단답형', rows: rows.filter((question) => question.type === 'short') },
		{
			label: '서술형',
			rows: rows.filter((question) => question.type === 'essay' && question !== lastEssay)
		},
		{ label: '논술형', rows: lastEssay ? [lastEssay] : [] }
	].map(({ label, rows }) => ({
		label,
		count: rows.length,
		points: rows.reduce((sum, question) => sum + question.points, 0)
	}));
}

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
