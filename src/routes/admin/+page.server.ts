import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { admin } from '$lib/server/guard';
import { database } from '$lib/server/db';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';
import { adminSections, loadAdminSection, type AdminSection } from '$lib/server/admin-dashboard';
import { invalidateExamConfig } from '$lib/server/exam-config';

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const make = () =>
	Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

function questionInput(data: FormData) {
	const type = String(data.get('type'));
	const content = String(data.get('content')).trim();
	const points = Number(data.get('points'));
	const options = data
		.getAll('option')
		.map((item) => String(item).trim())
		.filter(Boolean);
	const correctAnswers = data
		.getAll('correct')
		.map((item) => Number(item))
		.filter((item, index, items) => Number.isInteger(item) && items.indexOf(item) === index)
		.sort((a, b) => a - b);
	if (
		!['multiple', 'short', 'essay'].includes(type) ||
		!content ||
		!Number.isFinite(points) ||
		points <= 0
	) {
		return { error: '문제 유형, 내용과 배점을 확인해 주세요.' } as const;
	}
	if (
		type === 'multiple' &&
		(options.length < 2 ||
			!correctAnswers.length ||
			correctAnswers.some((answer) => answer < 0 || answer >= options.length))
	) {
		return { error: '객관식 보기를 두 개 이상 입력하고 정답을 선택해 주세요.' } as const;
	}
	return {
		value: {
			type,
			content,
			points,
			options: type === 'multiple' ? options : null,
			correctAnswer: type === 'multiple' ? correctAnswers[0] : null,
			correctAnswers: type === 'multiple' ? correctAnswers : null
		}
	} as const;
}

export const load = async (event) => {
	admin(event);
	const section = (event.params as Record<string, string | undefined>).section;
	if (!section) {
		const legacySection = event.url.searchParams.get('tab');
		const target = ['questions', 'codes', 'results'].includes(legacySection || '')
			? legacySection
			: 'overview';
		const attempt = target === 'results' ? event.url.searchParams.get('attempt') : null;
		redirect(307, `/admin/${target}${attempt ? `?attempt=${encodeURIComponent(attempt)}` : ''}`);
	}
	if (!adminSections.includes(section as AdminSection)) {
		error(404, '관리자 메뉴를 찾을 수 없습니다.');
	}
	return loadAdminSection(section as AdminSection, event.url);
};

export const actions = {
	question: async (event) => {
		const editor = admin(event);
		const data = await event.request.formData();
		const parsed = questionInput(data);
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const db = database();
		const max = await db
			.select({ n: questions.sortOrder })
			.from(questions)
			.orderBy(desc(questions.sortOrder))
			.limit(1);
		await db.insert(questions).values({
			...parsed.value,
			sortOrder: (max[0]?.n || 0) + 1,
			updatedById: editor.id,
			updatedByName: editor.displayName
		});
		invalidateExamConfig();
		return { success: '문제가 등록되었습니다.' };
	},
	updateQuestion: async (event) => {
		const editor = admin(event);
		const data = await event.request.formData();
		const id = String(data.get('id'));
		const revision = Number(data.get('revision'));
		const parsed = questionInput(data);
		if ('error' in parsed) return fail(400, { message: parsed.error });
		if (!Number.isSafeInteger(revision) || revision < 1) {
			return fail(400, {
				message: '문제의 수정 정보를 확인할 수 없습니다. 목록에서 다시 열어 주세요.'
			});
		}
		try {
			const db = database();
			const [existing] = await db.select().from(questions).where(eq(questions.id, id));
			if (!existing) return fail(404, { message: '수정할 문제를 찾지 못했습니다.' });
			if (existing.revision !== revision) {
				return fail(409, {
					message: '다른 관리자가 이 문제를 먼저 수정했습니다. 아래에서 두 내용을 비교해 주세요.',
					conflict: { latest: existing, draft: parsed.value }
				});
			}
			const updated = await db
				.update(questions)
				.set({
					...parsed.value,
					updatedAt: new Date(),
					revision: sql`${questions.revision} + 1`,
					updatedById: editor.id,
					updatedByName: editor.displayName
				})
				.where(and(eq(questions.id, id), eq(questions.revision, revision)))
				.returning({ id: questions.id });
			if (!updated.length) {
				const [latest] = await db.select().from(questions).where(eq(questions.id, id));
				return fail(409, {
					message: '다른 관리자가 이 문제를 먼저 수정했습니다. 아래에서 두 내용을 비교해 주세요.',
					conflict: latest ? { latest, draft: parsed.value } : undefined
				});
			}
			invalidateExamConfig();
			return { success: '문제를 수정했습니다.' };
		} catch (cause) {
			const errorId = crypto.randomUUID();
			console.error('[admin:updateQuestion] failed', {
				errorId,
				questionId: id,
				revision,
				editorId: editor.id,
				error: cause instanceof Error ? cause.message : String(cause)
			});
			return fail(500, {
				message: `문제 수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (오류 코드: ${errorId})`
			});
		}
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
		if (!Number.isFinite(score) || score < 0) {
			return fail(400, { message: '점수는 0점 이상의 숫자로 입력해 주세요.' });
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
			(item) =>
				scoreByQuestionId.get(item.id) !== null && scoreByQuestionId.get(item.id) !== undefined
		);
		const subjectiveScore = gradingComplete
			? subjectiveQuestions.reduce((sum, item) => sum + (scoreByQuestionId.get(item.id) || 0), 0)
			: null;
		await db
			.update(attempts)
			.set({
				subjectiveScore,
				totalScore: subjectiveScore === null ? null : attempt.objectiveScore + subjectiveScore
			})
			.where(eq(attempts.id, attemptId));

		redirect(303, `/admin/results?attempt=${encodeURIComponent(attemptId)}`);
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
		const questionId = String(data.get('id'));
		const deleted = await database().transaction(async (tx) => {
			const removed = await tx
				.delete(questions)
				.where(eq(questions.id, questionId))
				.returning({ id: questions.id });
			if (!removed.length) return false;

			const remaining = await tx.select().from(questions).orderBy(questions.sortOrder);
			for (const [index, question] of remaining.entries()) {
				const sortOrder = index + 1;
				if (question.sortOrder !== sortOrder) {
					await tx.update(questions).set({ sortOrder }).where(eq(questions.id, question.id));
				}
			}
			return true;
		});
		if (!deleted) return fail(404, { message: '삭제할 문제를 찾지 못했습니다.' });
		invalidateExamConfig();
		return { success: '문제를 삭제하고 남은 문제 번호를 정리했습니다.' };
	},
	deleteAttempt: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const attemptId = String(data.get('id'));
		const deleted = await database().transaction(async (tx) => {
			const removed = await tx
				.delete(attempts)
				.where(eq(attempts.id, attemptId))
				.returning({ codeId: attempts.codeId });
			if (!removed.length) return null;
			await tx
				.update(examCodes)
				.set({ status: 'expired' })
				.where(and(eq(examCodes.id, removed[0].codeId), eq(examCodes.reusable, false)));
			return removed[0];
		});
		if (!deleted) return fail(404, { message: '삭제할 응시 결과를 찾지 못했습니다.' });
		return {
			success: '응시 결과와 답안 데이터를 삭제했습니다. 연결된 코드는 재사용할 수 없습니다.'
		};
	},
	expireCode: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const id = String(data.get('id'));
		const [code] = await database().select().from(examCodes).where(eq(examCodes.id, id));
		if (!code) return fail(404, { message: '폐기할 응시 코드를 찾지 못했습니다.' });
		if (code.reusable) return fail(400, { message: '반복 사용 테스트 코드는 폐기할 수 없습니다.' });
		await database().update(examCodes).set({ status: 'expired' }).where(eq(examCodes.id, id));
		return { success: '코드를 폐기했습니다.' };
	}
};
