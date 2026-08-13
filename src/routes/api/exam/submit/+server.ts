import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { eq } from 'drizzle-orm';
import { submitExamMutation } from '$lib/domains/exam/shared/public';
import { ExamRequestError, examRequestError } from '$lib/domains/exam/server/public';
import { database } from '$lib/server/db';
import { attempts, examQuestions } from '$lib/server/schema';
import { user } from '$lib/server/guard';
import { closeAttempt } from '$lib/server/exam';

export const POST = async (event) => {
	const currentUser = user(event);
	try {
		const result = await executeContract(
			implementMutation(submitExamMutation, async ({ attemptId }) => {
				const db = database();
				const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
				if (!attempt || attempt.discordId !== currentUser.id) {
					throw new ExamRequestError(404, '진행 중인 시험이 없습니다.');
				}

				const completed = await closeAttempt(attempt.id, attempt.expiresAt <= new Date());
				if (!completed?.submittedAt) throw new Error('시험 제출 시간이 기록되지 않았습니다.');
				const questions = await db
					.select({ type: examQuestions.type, points: examQuestions.points })
					.from(examQuestions)
					.where(eq(examQuestions.attemptId, attempt.id));
				const objectiveMaxScore = questions
					.filter((question) => question.type === 'multiple')
					.reduce((sum, question) => sum + question.points, 0);

				return {
					submittedAt: completed.submittedAt.toISOString(),
					objectiveScore: completed.objectiveScore,
					objectiveMaxScore
				};
			}),
			await event.request.json()
		);
		return json(result);
	} catch (error) {
		const requestError = examRequestError(error, '제출할 시험 정보가 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '시험을 제출하지 못했습니다.' }, { status: 500 });
	}
};
