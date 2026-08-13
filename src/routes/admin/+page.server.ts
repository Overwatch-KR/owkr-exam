import { fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { admin } from '$lib/server/guard';
import { database } from '$lib/server/db';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const make = () =>
	Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

export const load = async (event) => {
	admin(event);
	const db = database();
	const allAttempts = await db.select().from(attempts).orderBy(desc(attempts.startedAt));
	const selectedAttemptId = event.url.searchParams.get('attempt');
	const gradingAttempt = selectedAttemptId
		? allAttempts.find((attempt) => attempt.id === selectedAttemptId) || null
		: null;
	let grading = null;

	if (gradingAttempt) {
		const snapshot = await db
			.select()
			.from(examQuestions)
			.where(eq(examQuestions.attemptId, gradingAttempt.id))
			.orderBy(asc(examQuestions.sortOrder));
		const submittedAnswers = snapshot.length
			? await db
					.select()
					.from(answers)
					.where(inArray(answers.attemptQuestionId, snapshot.map((question) => question.id)))
			: [];
		const answerByQuestionId = new Map(
			submittedAnswers.map((answer) => [answer.attemptQuestionId, answer])
		);
		const subjectiveQuestions = snapshot.filter((question) => question.type !== 'multiple');
		grading = {
			attempt: gradingAttempt,
			objectiveMaxScore: snapshot
				.filter((question) => question.type === 'multiple')
				.reduce((sum, question) => sum + question.points, 0),
			subjectiveMaxScore: subjectiveQuestions.reduce(
				(sum, question) => sum + question.points,
				0
			),
			gradedCount: subjectiveQuestions.filter(
				(question) => answerByQuestionId.get(question.id)?.score !== null && answerByQuestionId.get(question.id)?.score !== undefined
			).length,
			questions: subjectiveQuestions.map((question) => ({
				...question,
				answer: answerByQuestionId.get(question.id)?.value || '',
				score: answerByQuestionId.get(question.id)?.score ?? null
			}))
		};
	}

	return {
		questions: await db.select().from(questions).orderBy(asc(questions.sortOrder)),
		codes: await db.select().from(examCodes).orderBy(desc(examCodes.createdAt)),
		attempts: allAttempts,
		grading,
		initialTab: grading || event.url.searchParams.get('tab') === 'results' ? 'results' : 'questions'
	};
};

export const actions = {
	question: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const type = String(data.get('type'));
		const content = String(data.get('content')).trim();
		const points = Number(data.get('points'));
		const options = String(data.get('options') || '')
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
		const correctNumber = Number(data.get('correct'));
		if (!['multiple', 'short', 'essay'].includes(type) || !content || !Number.isInteger(points) || points <= 0) {
			return fail(400, { message: '문제 유형, 내용과 배점을 확인해 주세요.' });
		}
		if (
			type === 'multiple' &&
			(options.length < 2 || !Number.isInteger(correctNumber) || correctNumber < 1 || correctNumber > options.length)
		) {
			return fail(400, { message: '객관식 보기와 정답 번호를 확인해 주세요.' });
		}

		const db = database();
		const max = await db
			.select({ n: questions.sortOrder })
			.from(questions)
			.orderBy(desc(questions.sortOrder))
			.limit(1);
		await db.insert(questions).values({
			type,
			content,
			points,
			sortOrder: (max[0]?.n || 0) + 1,
			options: type === 'multiple' ? options : null,
			correctAnswer: type === 'multiple' ? correctNumber - 1 : null
		});
		return { success: '문제가 등록되었습니다.' };
	},
	grade: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const attemptId = String(data.get('attemptId'));
		const questionId = String(data.get('questionId'));
		const score = Number(data.get('score'));
		const db = database();
		const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
		const [question] = await db
			.select()
			.from(examQuestions)
			.where(and(eq(examQuestions.id, questionId), eq(examQuestions.attemptId, attemptId)));
		if (!attempt?.submittedAt || !question || question.type === 'multiple') {
			return fail(400, { message: '채점할 수 있는 답안을 찾지 못했습니다.' });
		}
		if (!Number.isInteger(score) || score < 0 || score > question.points) {
			return fail(400, { message: `점수는 0점부터 ${question.points}점까지 입력해 주세요.` });
		}

		await db
			.insert(answers)
			.values({ attemptQuestionId: question.id, value: '', score })
			.onConflictDoUpdate({
				target: answers.attemptQuestionId,
				set: { score, updatedAt: new Date() }
			});

		const subjectiveQuestions = (
			await db.select().from(examQuestions).where(eq(examQuestions.attemptId, attemptId))
		).filter((item) => item.type !== 'multiple');
		const scoredAnswers = subjectiveQuestions.length
			? await db
					.select()
					.from(answers)
					.where(
						inArray(
							answers.attemptQuestionId,
							subjectiveQuestions.map((item) => item.id)
						)
					)
			: [];
		const scoreByQuestionId = new Map(
			scoredAnswers.map((answer) => [answer.attemptQuestionId, answer.score])
		);
		const gradingComplete = subjectiveQuestions.every(
			(item) => scoreByQuestionId.get(item.id) !== null && scoreByQuestionId.get(item.id) !== undefined
		);
		const subjectiveScore = gradingComplete
			? subjectiveQuestions.reduce(
					(sum, item) => sum + (scoreByQuestionId.get(item.id) || 0),
					0
				)
			: null;
		await db
			.update(attempts)
			.set({
				subjectiveScore,
				totalScore: subjectiveScore === null ? null : attempt.objectiveScore + subjectiveScore
			})
			.where(eq(attempts.id, attemptId));

		redirect(303, `/admin?tab=results&attempt=${encodeURIComponent(attemptId)}`);
	},
	code: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const discordId = String(data.get('discordId')).trim();
		if (!/^\d{10,30}$/.test(discordId)) {
			return fail(400, { message: 'Discord User ID를 확인해 주세요.' });
		}
		const db = database();
		for (let i = 0; i < 5; i += 1) {
			try {
				await db.insert(examCodes).values({ code: make(), discordId });
				return { success: '응시 코드를 생성했습니다.' };
			} catch {
				// Retry with another random code on a collision.
			}
		}
		return fail(500, { message: '코드 생성에 실패했습니다. 다시 시도해 주세요.' });
	},
	deleteQuestion: async (event) => {
		admin(event);
		const data = await event.request.formData();
		await database().delete(questions).where(eq(questions.id, String(data.get('id'))));
		return { success: '문제를 삭제했습니다.' };
	},
	expireCode: async (event) => {
		admin(event);
		const data = await event.request.formData();
		await database()
			.update(examCodes)
			.set({ status: 'expired' })
			.where(eq(examCodes.id, String(data.get('id'))));
		return { success: '코드를 폐기했습니다.' };
	}
};
