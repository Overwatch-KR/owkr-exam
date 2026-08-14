import { asc, desc, eq, inArray } from 'drizzle-orm';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';
import { database } from '$lib/server/db';

export const adminSections = ['overview', 'questions', 'question-new', 'codes', 'results'] as const;
export type AdminSection = (typeof adminSections)[number];

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
		grading = {
			attempt: gradingAttempt,
			objectiveMaxScore: objectiveQuestions.reduce((sum, question) => sum + question.points, 0),
			subjectiveMaxScore: subjectiveQuestions.reduce((sum, question) => sum + question.points, 0),
			gradedCount: subjectiveQuestions.filter(
				(question) =>
					answerByQuestionId.get(question.id)?.score !== null &&
					answerByQuestionId.get(question.id)?.score !== undefined
			).length,
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

	return { section, attempts: allAttempts, grading };
}
