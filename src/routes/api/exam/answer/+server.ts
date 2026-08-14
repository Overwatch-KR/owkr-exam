import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { and, eq } from 'drizzle-orm';
import { saveAnswerMutation } from '$lib/domains/exam/shared/public';
import { ExamRequestError, examRequestError } from '$lib/domains/exam/server/public';
import { database } from '$lib/server/db';
import { answers, attempts, examQuestions } from '$lib/server/schema';
import { user } from '$lib/server/guard';
import { closeAttempt } from '$lib/server/exam';

function validChoiceAnswer(value: string, optionCount: number, allowsMultipleAnswers: boolean) {
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) {
			const unique = new Set(parsed);
			return (
				allowsMultipleAnswers &&
				unique.size === parsed.length &&
				parsed.length > 0 &&
				parsed.every((item) => Number.isInteger(item) && item >= 0 && item < optionCount)
			);
		}
	} catch {
		// 단일정답은 기존처럼 숫자 문자열을 허용합니다.
	}
	const choice = Number(value);
	return !allowsMultipleAnswers && Number.isInteger(choice) && choice >= 0 && choice < optionCount;
}

export const POST = async (e) => {
	const currentUser = user(e);
	try {
		const result = await executeContract(
			implementMutation(saveAnswerMutation, async ({ attemptQuestionId, value }) => {
				const db = database();
				const saveResult = await db.transaction(async (tx) => {
					const [question] = await tx
						.select()
						.from(examQuestions)
						.where(eq(examQuestions.id, attemptQuestionId));
					if (!question) throw new ExamRequestError(404, '문제를 찾을 수 없습니다.');
					if (
						question.type === 'multiple' &&
						value &&
						!validChoiceAnswer(
							value,
							question.options?.length ?? 0,
							(question.correctAnswers?.length ?? 0) > 1
						)
					) {
						throw new ExamRequestError(400, '객관식 선택 값을 확인해 주세요.');
					}
					const [attempt] = await tx
						.select()
						.from(attempts)
						.where(and(eq(attempts.id, question.attemptId), eq(attempts.discordId, currentUser.id)))
						.for('update');
					if (!attempt) throw new ExamRequestError(404, '응시 기록을 찾을 수 없습니다.');
					if (attempt.submittedAt) {
						throw new ExamRequestError(
							409,
							attempt.timedOut ? '시험 시간이 초과되었습니다.' : '이미 제출된 시험입니다.'
						);
					}
					if (attempt.expiresAt <= new Date()) {
						return { expiredAttemptId: attempt.id };
					}
					await tx
						.insert(answers)
						.values({ attemptQuestionId: question.id, value, updatedAt: new Date() })
						.onConflictDoUpdate({
							target: answers.attemptQuestionId,
							set: { value, updatedAt: new Date() }
						});
					return { expiredAttemptId: null };
				});
				if (saveResult.expiredAttemptId) {
					await closeAttempt(saveResult.expiredAttemptId, true);
					throw new ExamRequestError(409, '시험 시간이 초과되었습니다.');
				}
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
