import { asc, desc, eq, inArray } from 'drizzle-orm';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';
import { database } from '$lib/server/db';

export const adminSections = ['overview', 'questions', 'question-new', 'codes', 'results'] as const;
export type AdminSection = (typeof adminSections)[number];
const essayPassScore = 30;

type ManualQuestionScore = {
	id: string;
	type: string;
	points: number;
};

function manualScoreSummary(
	questions: ManualQuestionScore[],
	scoreByQuestionId: Map<string, number | null>,
	type: 'short' | 'essay'
) {
	const matching = questions.filter((question) => question.type === type);
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

export async function loadAdminSection(section: AdminSection, url: URL) {
	const db = database();

	if (section === 'overview') {
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

	const allAttempts = await db.select().from(attempts).orderBy(desc(attempts.startedAt));
	const scoreRows = allAttempts.length
		? await db
				.select({
					id: examQuestions.id,
					attemptId: examQuestions.attemptId,
					type: examQuestions.type,
					points: examQuestions.points,
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
		const short = manualScoreSummary(attemptQuestions, scoreByQuestionId, 'short');
		const essay = manualScoreSummary(attemptQuestions, scoreByQuestionId, 'essay');
		return {
			...attempt,
			shortScore: short.score,
			shortMaxScore: short.maxScore,
			essayScore: essay.score,
			essayMaxScore: essay.maxScore,
			essayPassed: essay.score === null ? null : essay.score >= essayPassScore
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
		const short = manualScoreSummary(subjectiveQuestions, gradingScoreByQuestionId, 'short');
		const essay = manualScoreSummary(subjectiveQuestions, gradingScoreByQuestionId, 'essay');
		grading = {
			attempt: gradingAttempt,
			objectiveMaxScore: objectiveQuestions.reduce((sum, question) => sum + question.points, 0),
			shortScore: short.score,
			shortMaxScore: short.maxScore,
			essayScore: essay.score,
			essayMaxScore: essay.maxScore,
			essayPassScore,
			essayPassed: essay.score === null ? null : essay.score >= essayPassScore,
			gradedCount: short.gradedCount + essay.gradedCount,
			questions: subjectiveQuestions.map((question) => ({
				...question,
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
