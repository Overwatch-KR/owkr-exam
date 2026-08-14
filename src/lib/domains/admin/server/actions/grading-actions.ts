import { fail } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { admin } from '$lib/server/guard';
import { answers, attempts, examQuestions } from '$lib/server/schema';
import type { AdminAction } from './types';

const gradeAll: AdminAction = async (event) => {
	admin(event);
	const data = await event.request.formData();
	const attemptId = String(data.get('attemptId'));
	const db = database();
	const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
	const subjectiveQuestions = (
		await db.select().from(examQuestions).where(eq(examQuestions.attemptId, attemptId))
	).filter((question) => question.type !== 'multiple');
	if (!attempt?.submittedAt || !subjectiveQuestions.length) {
		return fail(400, { message: '채점할 수 있는 응시 기록을 찾지 못했습니다.' });
	}

	const scores: Array<{ questionId: string; score: number }> = [];
	for (const question of subjectiveQuestions) {
		const raw = String(data.get(`score-${question.id}`) ?? '').trim();
		if (!raw) continue;
		const score = Number(raw);
		if (!Number.isFinite(score) || score < 0) {
			return fail(400, { message: `문제 ${question.sortOrder}의 점수를 확인해 주세요.` });
		}
		scores.push({ questionId: question.id, score });
	}
	if (!scores.length) return fail(400, { message: '저장할 점수를 하나 이상 입력해 주세요.' });

	try {
		await db.transaction(async (tx) => {
			const [lockedAttempt] = await tx
				.select()
				.from(attempts)
				.where(eq(attempts.id, attemptId))
				.for('update');
			if (!lockedAttempt?.submittedAt) throw new Error('채점할 응시 기록이 종료되지 않았습니다.');
			for (const item of scores) {
				await tx
					.insert(answers)
					.values({ attemptQuestionId: item.questionId, value: '', score: item.score })
					.onConflictDoUpdate({
						target: answers.attemptQuestionId,
						set: { score: item.score, updatedAt: new Date() }
					});
			}
			const scoredAnswers = await tx
				.select()
				.from(answers)
				.where(
					inArray(
						answers.attemptQuestionId,
						subjectiveQuestions.map((question) => question.id)
					)
				);
			const scoreByQuestionId = new Map(
				scoredAnswers.map((answer) => [answer.attemptQuestionId, answer.score])
			);
			const gradingComplete = subjectiveQuestions.every(
				(question) =>
					scoreByQuestionId.get(question.id) !== null && scoreByQuestionId.has(question.id)
			);
			const subjectiveScore = gradingComplete
				? subjectiveQuestions.reduce(
						(sum, question) => sum + (scoreByQuestionId.get(question.id) ?? 0),
						0
					)
				: null;
			await tx
				.update(attempts)
				.set({
					subjectiveScore,
					totalScore:
						subjectiveScore === null ? null : lockedAttempt.objectiveScore + subjectiveScore
				})
				.where(eq(attempts.id, attemptId));
		});
	} catch (cause) {
		console.error('[admin:gradeAll] failed', {
			attemptId,
			error: cause instanceof Error ? cause.message : String(cause)
		});
		return fail(500, { message: '채점 점수를 저장하지 못했습니다. 다시 시도해 주세요.' });
	}
	return { success: `${scores.length}개 문항의 채점 점수를 저장했습니다.` };
};

export const gradingActions: Record<string, AdminAction> = { gradeAll };
