import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { answers, attempts, examQuestions } from '$lib/server/schema';
import { closeAttempt } from '../close-attempt';
import type { SubmitExamMutationInput, SubmitExamMutationResult } from '../../shared/public';
import { ExamRequestError } from '../errors';
import type { ExamUser } from '../user';

export async function submitExam(
	{ attemptId, timeout = false }: SubmitExamMutationInput,
	currentUser: ExamUser
): Promise<SubmitExamMutationResult> {
	const db = database();
	const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
	if (!attempt || attempt.discordId !== currentUser.id) {
		throw new ExamRequestError(404, '진행 중인 시험이 없습니다.');
	}
	const completed = await closeAttempt(attempt.id, timeout);
	if (!completed?.submittedAt) {
		throw new ExamRequestError(
			409,
			completed?.pausedAt
				? '관리자가 시험 시간을 일시 중지했습니다.'
				: '시험 시간이 변경되었습니다. 남은 시간을 다시 확인해 주세요.'
		);
	}

	const questions = await db
		.select({ value: answers.value })
		.from(examQuestions)
		.leftJoin(answers, eq(answers.attemptQuestionId, examQuestions.id))
		.where(eq(examQuestions.attemptId, attempt.id));
	return {
		submittedAt: completed.submittedAt.toISOString(),
		answeredCount: questions.filter((question) => question.value?.trim()).length,
		questionCount: questions.length,
		timedOut: completed.timedOut
	};
}
