import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';
import { closeAttempt } from '$lib/domains/exam/server/public';

export const adminSections = ['overview', 'questions', 'question-new', 'codes', 'results'] as const;
export type AdminSection = (typeof adminSections)[number];
const writingPassScore = 30;

type ManualQuestionScore = {
	id: string;
	type: string;
	points: number;
	sortOrder: number;
};

type ManualScoreCategory = 'short' | 'descriptive' | 'longEssay' | 'writing';

function longEssayQuestionId(questions: ManualQuestionScore[]) {
	return questions
		.filter((question) => question.type === 'essay')
		.sort((left, right) => right.sortOrder - left.sortOrder)[0]?.id;
}

function isInManualScoreCategory(
	question: ManualQuestionScore,
	category: ManualScoreCategory,
	longEssayId: string | undefined
) {
	if (category === 'short') return question.type === 'short';
	if (category === 'writing') return question.type === 'essay';
	if (category === 'longEssay') return question.id === longEssayId;
	return question.type === 'essay' && question.id !== longEssayId;
}

function manualScoreSummary(
	questions: ManualQuestionScore[],
	scoreByQuestionId: Map<string, number | null>,
	category: ManualScoreCategory,
	longEssayId = longEssayQuestionId(questions)
) {
	const matching = questions.filter((question) =>
		isInManualScoreCategory(question, category, longEssayId)
	);
	const graded =
		matching.length > 0 &&
		matching.every(
			(question) =>
				scoreByQuestionId.get(question.id) !== null && scoreByQuestionId.has(question.id)
		);
	return {
		maxScore: matching.reduce((sum, question) => sum + question.points, 0),
		score: graded
			? matching.reduce((sum, question) => sum + (scoreByQuestionId.get(question.id) ?? 0), 0)
			: null,
		gradedCount: matching.filter(
			(question) =>
				scoreByQuestionId.get(question.id) !== null && scoreByQuestionId.has(question.id)
		).length
	};
}

function manualScoreBreakdown(
	questions: ManualQuestionScore[],
	scoreByQuestionId: Map<string, number | null>
) {
	const longEssayId = longEssayQuestionId(questions);
	return {
		longEssayId,
		short: manualScoreSummary(questions, scoreByQuestionId, 'short', longEssayId),
		descriptive: manualScoreSummary(questions, scoreByQuestionId, 'descriptive', longEssayId),
		longEssay: manualScoreSummary(questions, scoreByQuestionId, 'longEssay', longEssayId),
		writing: manualScoreSummary(questions, scoreByQuestionId, 'writing', longEssayId)
	};
}

async function closeExpiredAttempts() {
	const expired = await database()
		.select({ id: attempts.id })
		.from(attempts)
		.where(
			and(
				isNull(attempts.submittedAt),
				isNull(attempts.pausedAt),
				lte(attempts.expiresAt, new Date())
			)
		);
	for (const attempt of expired) await closeAttempt(attempt.id, true);
}

export async function loadAdminSection(section: AdminSection, url: URL) {
	const db = database();

	if (section === 'overview') {
		await closeExpiredAttempts();
		const [allAttempts, allCodes, recentCodes] = await Promise.all([
			db.select().from(attempts).orderBy(desc(attempts.startedAt)),
			db.select().from(examCodes),
			db.select().from(examCodes).orderBy(desc(examCodes.createdAt)).limit(5)
		]);
		const needsGrading = allAttempts.filter((item) => item.submittedAt && item.totalScore === null);
		return {
			section,
			overview: {
				inProgress: allAttempts.filter((item) => !item.submittedAt).length,
				needsGradingCount: needsGrading.length,
				completed: allAttempts.filter((item) => item.totalScore !== null).length,
				unusedCodes: allCodes.filter((item) => item.status === 'unused').length,
				needsGrading: needsGrading.slice(0, 6),
				recentCodes
			}
		};
	}

	if (section === 'question-new') return { section };

	if (section === 'questions') {
		const allQuestions = await db.select().from(questions).orderBy(asc(questions.sortOrder));
		const selectedQuestionId = url.searchParams.get('question');
		return {
			section,
			questions: allQuestions,
			selectedQuestion: selectedQuestionId
				? allQuestions.find((question) => question.id === selectedQuestionId) || null
				: null
		};
	}

	if (section === 'codes') {
		return { section, codes: await db.select().from(examCodes).orderBy(desc(examCodes.createdAt)) };
	}

	await closeExpiredAttempts();
	const allAttempts = await db.select().from(attempts).orderBy(desc(attempts.startedAt));
	const scoreRows = allAttempts.length
		? await db
				.select({
					id: examQuestions.id,
					attemptId: examQuestions.attemptId,
					type: examQuestions.type,
					points: examQuestions.points,
					sortOrder: examQuestions.sortOrder,
					score: answers.score
				})
				.from(examQuestions)
				.leftJoin(answers, eq(answers.attemptQuestionId, examQuestions.id))
				.where(
					inArray(
						examQuestions.attemptId,
						allAttempts.map((attempt) => attempt.id)
					)
				)
		: [];
	const scoreByQuestionId = new Map(scoreRows.map((question) => [question.id, question.score]));
	const questionsByAttemptId = new Map<string, ManualQuestionScore[]>();
	for (const question of scoreRows) {
		const existing = questionsByAttemptId.get(question.attemptId) ?? [];
		existing.push(question);
		questionsByAttemptId.set(question.attemptId, existing);
	}
	const attemptsWithScores = allAttempts.map((attempt) => {
		const attemptQuestions = questionsByAttemptId.get(attempt.id) ?? [];
		const scores = manualScoreBreakdown(attemptQuestions, scoreByQuestionId);
		return {
			...attempt,
			shortScore: scores.short.score,
			shortMaxScore: scores.short.maxScore,
			descriptiveScore: scores.descriptive.score,
			descriptiveMaxScore: scores.descriptive.maxScore,
			longEssayScore: scores.longEssay.score,
			longEssayMaxScore: scores.longEssay.maxScore,
			writingScore: scores.writing.score,
			writingMaxScore: scores.writing.maxScore,
			writingPassed: scores.writing.score === null ? null : scores.writing.score >= writingPassScore
		};
	});
	const selectedAttemptId = url.searchParams.get('attempt');
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
					.where(
						inArray(
							answers.attemptQuestionId,
							snapshot.map((question) => question.id)
						)
					)
			: [];
		const answerByQuestionId = new Map(
			submittedAnswers.map((answer) => [answer.attemptQuestionId, answer])
		);
		const subjectiveQuestions = snapshot.filter((question) => question.type !== 'multiple');
		const objectiveQuestions = snapshot.filter((question) => question.type === 'multiple');
		const gradingScoreByQuestionId = new Map(
			submittedAnswers.map((answer) => [answer.attemptQuestionId, answer.score])
		);
		const scores = manualScoreBreakdown(subjectiveQuestions, gradingScoreByQuestionId);
		grading = {
			attempt: gradingAttempt,
			objectiveMaxScore: objectiveQuestions.reduce((sum, question) => sum + question.points, 0),
			shortScore: scores.short.score,
			shortMaxScore: scores.short.maxScore,
			descriptiveScore: scores.descriptive.score,
			descriptiveMaxScore: scores.descriptive.maxScore,
			longEssayScore: scores.longEssay.score,
			longEssayMaxScore: scores.longEssay.maxScore,
			writingScore: scores.writing.score,
			writingMaxScore: scores.writing.maxScore,
			writingPassScore,
			writingPassed:
				scores.writing.score === null ? null : scores.writing.score >= writingPassScore,
			gradedCount:
				scores.short.gradedCount + scores.descriptive.gradedCount + scores.longEssay.gradedCount,
			questions: subjectiveQuestions.map((question) => ({
				...question,
				manualType:
					question.type === 'short'
						? ('short' as const)
						: question.id === scores.longEssayId
							? ('longEssay' as const)
							: ('descriptive' as const),
				answer: answerByQuestionId.get(question.id)?.value || '',
				score: answerByQuestionId.get(question.id)?.score ?? null
			})),
			objectiveQuestions: objectiveQuestions.map((question) => ({
				...question,
				answer: answerByQuestionId.get(question.id)?.value || ''
			}))
		};
	}

	return { section, attempts: attemptsWithScores, grading };
}
