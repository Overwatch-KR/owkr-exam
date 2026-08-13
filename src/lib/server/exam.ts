import {and, eq, inArray, isNull} from 'drizzle-orm';
import {answers, attempts, examCodes, examQuestions} from './schema';
import {database} from './db';

export async function closeAttempt(id: string, timedOut = false) {
		const db = database();
		const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id));
		if (!attempt || attempt.submittedAt) return attempt;

		const now = new Date();
		const questions = await db.select().from(examQuestions).where(eq(examQuestions.attemptId, id));
		const submittedAnswers = questions.length
				? await db
						.select()
						.from(answers)
						.where(inArray(answers.attemptQuestionId, questions.map((question) => question.id)))
				: [];
		const answerByQuestionId = new Map(
				submittedAnswers.map((answer) => [answer.attemptQuestionId, answer])
		);
		let objectiveScore = 0;
		for (const question of questions) {
				const value = answerByQuestionId.get(question.id)?.value;
				if (question.type === 'multiple' && value === String(question.correctAnswer)) {
						objectiveScore += question.points;
				}
		}

		const needsManualGrading = questions.some((question) => question.type !== 'multiple');
		const [updated] = await db
				.update(attempts)
				.set({
						submittedAt: now,
						timedOut,
						objectiveScore,
						totalScore: needsManualGrading ? null : objectiveScore
				})
				.where(and(eq(attempts.id, id), isNull(attempts.submittedAt)))
				.returning();
		if (updated) {
				await db
						.update(examCodes)
						.set({status: 'completed', completedAt: now})
						.where(eq(examCodes.id, updated.codeId));
		}
		return updated || attempt;
}

export async function ensureOpen(id: string, userId: string) {
		const [attempt] = await database()
				.select()
				.from(attempts)
				.where(and(eq(attempts.id, id), eq(attempts.discordId, userId)));
		if (!attempt) throw new Error('응시 기록을 찾을 수 없습니다.');
		if (!attempt.submittedAt && attempt.expiresAt <= new Date()) await closeAttempt(id, true);
		const [fresh] = await database().select().from(attempts).where(eq(attempts.id, id));
		return fresh;
}
