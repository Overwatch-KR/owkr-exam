import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { startExamMutation } from '$lib/domains/exam/shared/public';
import { ExamRequestError, examRequestError } from '$lib/domains/exam/server/public';
import { database } from '$lib/server/db';
import { attempts, examCodes, examQuestions, questions, answers } from '$lib/server/schema';
import { user } from '$lib/server/guard';

function shuffle<T>(items: T[]) {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	return shuffled;
}

function randomizedQuestionOrder<T extends { type: string; sortOrder: number }>(questions: T[]) {
	// 운영 규칙: 35번 논술형은 항상 마지막에 둔다.
	const fixedLast = questions.find(
		(question) => question.type === 'essay' && question.sortOrder === 35
	);
	const movable = fixedLast ? questions.filter((question) => question !== fixedLast) : questions;
	const byType = ['multiple', 'short', 'essay'].flatMap((type) =>
		shuffle(movable.filter((question) => question.type === type))
	);
	return fixedLast ? [...byType, fixedLast] : byType;
}

export const POST = async (e) => {
	const u = user(e);
	const requestStartedAt = performance.now();
	try {
		const result = await executeContract(
			implementMutation(startExamMutation, async ({ code: examCode }) => {
				const db = database();
				return db.transaction(async (tx) => {
					const [code] = await tx
						.select()
						.from(examCodes)
						.where(eq(examCodes.code, examCode))
						.for('update');
					if (!code) throw new ExamRequestError(404, '존재하지 않는 코드입니다.');
					if (code.discordId !== u.id) {
						throw new ExamRequestError(403, '다른 Discord 계정에 발급된 코드입니다.');
					}
					let [attempt] = await tx
						.select()
						.from(attempts)
						.where(and(eq(attempts.codeId, code.id), isNull(attempts.submittedAt)));
					if (!attempt) {
						if (!code.reusable && code.status !== 'unused') {
							throw new ExamRequestError(409, '이미 사용되었거나 만료된 코드입니다.');
						}
						const now = new Date();
						const expires = new Date(now.getTime() + 3600000);
						[attempt] = await tx
							.insert(attempts)
							.values({
								codeId: code.id,
								discordId: u.id,
								username: u.username,
								displayName: u.displayName,
								avatar: u.avatar,
								startedAt: now,
								expiresAt: expires
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
						const orderedQuestions = randomizedQuestionOrder(sourceQuestions);
						await tx.insert(examQuestions).values(
							orderedQuestions.map((question, index) => ({
								attemptId: attempt.id,
								sourceQuestionId: question.id,
								type: question.type,
								content: question.content,
								options: question.options,
								correctAnswer: question.correctAnswer,
								correctAnswers: question.correctAnswers,
								points: question.points,
								// Save the resolved order so this attempt remains unchanged later.
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
						id: attempt.id,
						expiresAt: attempt.expiresAt.toISOString(),
						questions: examQuestionRows.map((question) => ({
							id: question.id,
							type: question.type as 'multiple' | 'short' | 'essay',
							content: question.content,
							options: question.options ?? [],
							allowsMultipleAnswers: (question.correctAnswers?.length ?? 0) > 1,
							points: question.points,
							answer:
								savedAnswers.find((answer) => answer.attemptQuestionId === question.id)?.value || ''
						}))
					};
				});
			}),
			await e.request.json()
		);
		const duration = performance.now() - requestStartedAt;
		console.info('exam_start_completed', { durationMs: Math.round(duration) });
		return json(result, {
			headers: { 'Server-Timing': `exam-start;dur=${duration.toFixed(1)}` }
		});
	} catch (err) {
		const requestError = examRequestError(err, '올바른 6자리 코드를 입력해 주세요.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(err);
		return json({ message: '시험을 시작하지 못했습니다.' }, { status: 500 });
	}
};
