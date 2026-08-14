import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';
import { closeAttempt } from '../close-attempt';
import type { StartExamMutationInput, StartExamMutationResult } from '../../shared/public';
import { ExamRequestError } from '../errors';
import type { ExamUser } from '../user';

function shuffle<T>(items: T[]) {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	return shuffled;
}

function randomizedQuestionOrder<T extends { type: string; sortOrder: number }>(questions: T[]) {
	const fixedLast = questions.find(
		(question) => question.type === 'essay' && question.sortOrder === 35
	);
	const movable = fixedLast ? questions.filter((question) => question !== fixedLast) : questions;
	const byType = ['multiple', 'short', 'essay'].flatMap((type) =>
		shuffle(movable.filter((question) => question.type === type))
	);
	return fixedLast ? [...byType, fixedLast] : byType;
}

export async function startExam(
	{ code: examCode }: StartExamMutationInput,
	currentUser: ExamUser
): Promise<StartExamMutationResult> {
	const startResult = await database().transaction(async (tx) => {
		const [code] = await tx
			.select()
			.from(examCodes)
			.where(eq(examCodes.code, examCode))
			.for('update');
		if (!code) throw new ExamRequestError(404, '존재하지 않는 코드입니다.');
		if (code.discordId !== currentUser.id) {
			throw new ExamRequestError(403, '다른 Discord 계정에 발급된 코드입니다.');
		}

		let [attempt] = await tx
			.select()
			.from(attempts)
			.where(and(eq(attempts.codeId, code.id), isNull(attempts.submittedAt)));
		if (attempt && !attempt.pausedAt && attempt.expiresAt <= new Date()) {
			return { type: 'expired' as const, attemptId: attempt.id };
		}

		if (!attempt) {
			if (!code.reusable && code.status !== 'unused') {
				throw new ExamRequestError(409, '이미 사용되었거나 만료된 코드입니다.');
			}
			const now = new Date();
			[attempt] = await tx
				.insert(attempts)
				.values({
					codeId: code.id,
					discordId: currentUser.id,
					username: currentUser.username,
					displayName: currentUser.displayName,
					avatar: currentUser.avatar,
					startedAt: now,
					expiresAt: new Date(now.getTime() + 3_600_000)
				})
				.returning();

			const sourceQuestions = await tx
				.select()
				.from(questions)
				.where(eq(questions.active, true))
				.orderBy(asc(questions.sortOrder));
			if (!sourceQuestions.length) {
				throw new ExamRequestError(400, '등록된 활성 문제가 없습니다.');
			}
			await tx.insert(examQuestions).values(
				randomizedQuestionOrder(sourceQuestions).map((question, index) => ({
					attemptId: attempt.id,
					sourceQuestionId: question.id,
					type: question.type,
					content: question.content,
					options: question.options,
					correctAnswer: question.correctAnswer,
					correctAnswers: question.correctAnswers,
					points: question.points,
					sortOrder: index + 1
				}))
			);
			if (!code.reusable) {
				await tx
					.update(examCodes)
					.set({ status: 'in_progress', startedAt: now })
					.where(eq(examCodes.id, code.id));
			}
		}

		const examQuestionRows = await tx
			.select()
			.from(examQuestions)
			.where(eq(examQuestions.attemptId, attempt.id))
			.orderBy(asc(examQuestions.sortOrder));
		const savedAnswers = examQuestionRows.length
			? await tx
					.select()
					.from(answers)
					.where(
						inArray(
							answers.attemptQuestionId,
							examQuestionRows.map((question) => question.id)
						)
					)
			: [];
		return {
			type: 'ready' as const,
			attempt: {
				id: attempt.id,
				expiresAt: attempt.expiresAt.toISOString(),
				pausedAt: attempt.pausedAt?.toISOString() ?? null,
				questions: examQuestionRows.map((question) => ({
					id: question.id,
					type: question.type as 'multiple' | 'short' | 'essay',
					content: question.content,
					options: question.options ?? [],
					allowsMultipleAnswers: (question.correctAnswers?.length ?? 0) > 1,
					points: question.points,
					answer:
						savedAnswers.find((answer) => answer.attemptQuestionId === question.id)?.value ?? ''
				}))
			}
		};
	});

	if (startResult.type === 'expired') {
		await closeAttempt(startResult.attemptId, true);
		throw new ExamRequestError(409, '시험 시간이 초과되었습니다.');
	}
	return startResult.attempt;
}
