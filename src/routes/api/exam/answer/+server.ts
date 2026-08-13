import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { eq } from 'drizzle-orm';
import { saveAnswerMutation } from '$lib/domains/exam/shared/public';
import { ExamRequestError, examRequestError } from '$lib/domains/exam/server/public';
import { database } from '$lib/server/db';
import { answers, examQuestions } from '$lib/server/schema';
import { user } from '$lib/server/guard';
import { ensureOpen } from '$lib/server/exam';

export const POST = async (e) => {
	const currentUser = user(e);
	try {
		const result = await executeContract(
			implementMutation(saveAnswerMutation, async ({ attemptQuestionId, value }) => {
				const db = database();
				const [question] = await db
					.select()
					.from(examQuestions)
					.where(eq(examQuestions.id, attemptQuestionId));
				if (!question) throw new ExamRequestError(404, '문제를 찾을 수 없습니다.');
				const attempt = await ensureOpen(question.attemptId, currentUser.id).catch(() => {
					throw new ExamRequestError(404, '응시 기록을 찾을 수 없습니다.');
				});
				if (!attempt) throw new ExamRequestError(404, '응시 기록을 찾을 수 없습니다.');
				if (attempt.submittedAt) {
					throw new ExamRequestError(
						409,
						attempt.timedOut ? '시험 시간이 초과되었습니다.' : '이미 제출된 시험입니다.'
					);
				}
				await db
					.insert(answers)
					.values({ attemptQuestionId: question.id, value, updatedAt: new Date() })
					.onConflictDoUpdate({
						target: answers.attemptQuestionId,
						set: { value, updatedAt: new Date() }
					});
				return { ok: true as const };
			}),
			await e.request.json()
		);
		return json(result);
	} catch (error) {
		const requestError = examRequestError(error, '입력이 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '답안을 저장하지 못했습니다.' }, { status: 500 });
	}
};
