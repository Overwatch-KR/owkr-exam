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

	const scores: Array<{
		questionId: string;
		sortOrder: number;
		score: number;
		base: number | null;
	}> = [];
	for (const question of subjectiveQuestions) {
		const raw = String(data.get(`score-${question.id}`) ?? '').trim();
		if (!raw) continue;
		const score = Number(raw);
		if (!Number.isFinite(score) || score < 0 || score > question.points) {
			return fail(400, {
				message: `문제 ${question.sortOrder}의 점수는 0점부터 ${question.points}점까지 입력해 주세요.`
			});
		}
		const baseline = data.get(`base-${question.id}`);
		if (typeof baseline !== 'string')
			return fail(409, { message: '채점 화면을 새로고침한 뒤 다시 저장해 주세요.' });
		const base = baseline === '' ? null : Number(baseline);
		if (base !== null && (!Number.isFinite(base) || base < 0 || base > question.points))
			return fail(400, { message: '기존 점수가 올바르지 않습니다. 채점 화면을 다시 열어 주세요.' });
		if (score === base) continue;
		scores.push({ questionId: question.id, sortOrder: question.sortOrder, score, base });
	}
	if (!scores.length) return fail(400, { message: '저장할 점수를 하나 이상 입력해 주세요.' });

	try {
		const conflicts = await db.transaction(async (tx) => {
			const [lockedAttempt] = await tx
				.select()
				.from(attempts)
				.where(eq(attempts.id, attemptId))
				.for('update');
			if (!lockedAttempt?.submittedAt) throw new Error('채점할 응시 기록이 종료되지 않았습니다.');
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
			const conflicts = scores.flatMap((item) => {
				const current = scoreByQuestionId.get(item.questionId) ?? null;
				return current !== item.base && current !== item.score ? [{ ...item, current }] : [];
			});
			if (conflicts.length) return conflicts;
			for (const item of scores) {
				scoreByQuestionId.set(item.questionId, item.score);
				await tx
					.insert(answers)
					.values({ attemptQuestionId: item.questionId, value: '', score: item.score })
					.onConflictDoUpdate({
						target: answers.attemptQuestionId,
						set: { score: item.score, updatedAt: new Date() }
					});
			}
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
			return [];
		});
		if (conflicts.length)
			return fail(409, {
				message: '다른 운영자가 수정한 점수를 비교해 주세요.',
				gradeConflicts: conflicts
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
