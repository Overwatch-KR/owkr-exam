import { and, eq, inArray, isNull } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { answers, attempts, examCodes, examQuestions } from '$lib/server/schema';

function answerIndices(value: string) {
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) {
			return [...new Set(parsed.filter(Number.isInteger))].sort((a, b) => a - b);
		}
	} catch {
		// 기존 단일정답 값은 숫자 문자열로 저장되어 있습니다.
	}
	const index = Number(value);
	return Number.isInteger(index) ? [index] : [];
}

function isCorrectMultipleAnswer(value: string, question: typeof examQuestions.$inferSelect) {
	const expected = question.correctAnswers?.length
		? [...question.correctAnswers].sort((a, b) => a - b)
		: question.correctAnswer === null
			? []
			: [question.correctAnswer];
	const actual = answerIndices(value);
	return (
		expected.length === actual.length && expected.every((answer, index) => answer === actual[index])
	);
}

export async function closeAttempt(id: string, timedOut = false) {
	const db = database();
	return db.transaction(async (tx) => {
		const [attempt] = await tx.select().from(attempts).where(eq(attempts.id, id)).for('update');
		if (!attempt || attempt.submittedAt) return attempt;

		const now = new Date();
		if (timedOut && (attempt.pausedAt || attempt.expiresAt > now)) return attempt;
		const questions = await tx.select().from(examQuestions).where(eq(examQuestions.attemptId, id));
		const submittedAnswers = questions.length
			? await tx
					.select()
					.from(answers)
					.where(
						inArray(
							answers.attemptQuestionId,
							questions.map((question) => question.id)
						)
					)
			: [];
		const answerByQuestionId = new Map(
			submittedAnswers.map((answer) => [answer.attemptQuestionId, answer])
		);
		let objectiveScore = 0;
		for (const question of questions) {
			const value = answerByQuestionId.get(question.id)?.value;
			if (question.type === 'multiple' && value && isCorrectMultipleAnswer(value, question)) {
				objectiveScore += question.points;
			}
		}

		const needsManualGrading = questions.some((question) => question.type !== 'multiple');
		const [updated] = await tx
			.update(attempts)
			.set({
				submittedAt: now,
				timedOut,
				pausedAt: null,
				objectiveScore,
				totalScore: needsManualGrading ? null : objectiveScore
			})
			.where(and(eq(attempts.id, id), isNull(attempts.submittedAt)))
			.returning();
		if (updated) {
			await tx
				.update(examCodes)
				.set({ status: 'completed', completedAt: now })
				.where(and(eq(examCodes.id, updated.codeId), eq(examCodes.reusable, false)));
		}
		return updated || attempt;
	});
}
