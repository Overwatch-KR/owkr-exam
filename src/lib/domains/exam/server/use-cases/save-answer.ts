import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { answers, attempts, examQuestions } from '$lib/server/schema';
import { closeAttempt } from '../close-attempt';
import type { SaveAnswerMutationInput, SaveAnswerMutationResult } from '../../shared/public';
import { ExamRequestError } from '../errors';
import type { ExamUser } from '../user';

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
		// 기존 단일정답 값은 숫자 문자열로 저장되어 있습니다.
	}
	const choice = Number(value);
	return !allowsMultipleAnswers && Number.isInteger(choice) && choice >= 0 && choice < optionCount;
}

export async function saveAnswer(
	{ attemptQuestionId, value }: SaveAnswerMutationInput,
	currentUser: ExamUser
): Promise<SaveAnswerMutationResult> {
	const saveResult = await database().transaction(async (tx) => {
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
		if (attempt.pausedAt) {
			throw new ExamRequestError(409, '관리자가 시험 시간을 일시 중지했습니다.');
		}
		if (attempt.expiresAt <= new Date()) return { expiredAttemptId: attempt.id };

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
	return { ok: true };
}
