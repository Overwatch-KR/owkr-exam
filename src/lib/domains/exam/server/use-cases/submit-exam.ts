import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { attempts, examQuestions } from '$lib/server/schema';
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
	if (!attempt.submittedAt && attempt.pausedAt) {
		throw new ExamRequestError(409, '관리자가 시험 시간을 일시 중지했습니다.');
	}

	const timedOut = attempt.submittedAt
		? attempt.timedOut
		: !attempt.pausedAt && attempt.expiresAt <= new Date();
	if (!attempt.submittedAt && timeout && !timedOut) {
		throw new ExamRequestError(
			409,
			attempt.pausedAt
				? '관리자가 시험 시간을 일시 중지했습니다.'
				: '시험 시간이 연장되었습니다. 남은 시간을 다시 확인해 주세요.'
		);
	}
	const completed = await closeAttempt(attempt.id, timedOut);
	if (!completed?.submittedAt) {
		throw new ExamRequestError(
			409,
			completed?.pausedAt
				? '관리자가 시험 시간을 일시 중지했습니다.'
				: '시험 시간이 변경되었습니다. 남은 시간을 다시 확인해 주세요.'
		);
	}

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
}
