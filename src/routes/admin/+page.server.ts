import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { admin } from '$lib/server/guard';
import { database } from '$lib/server/db';
import { answers, attempts, examCodes, examQuestions, questions } from '$lib/server/schema';
import { adminSections, loadAdminSection, type AdminSection } from '$lib/server/admin-dashboard';
import { invalidateExamConfig } from '$lib/server/exam-config';
import { closeAttempt } from '$lib/server/exam';

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
	pauseAttempt: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const attemptId = String(data.get('id'));
		const now = new Date();
		const state = await database().transaction(async (tx) => {
			const [attempt] = await tx
				.select()
				.from(attempts)
				.where(eq(attempts.id, attemptId))
				.for('update');
			if (!attempt) return 'missing' as const;
			if (attempt.submittedAt) return 'submitted' as const;
			if (attempt.pausedAt) return 'paused' as const;
			if (attempt.expiresAt <= now) return 'expired' as const;
			await tx.update(attempts).set({ pausedAt: now }).where(eq(attempts.id, attempt.id));
			return 'updated' as const;
		});
		if (state === 'missing') return fail(404, { message: '응시 기록을 찾지 못했습니다.' });
		if (state === 'submitted') return fail(409, { message: '이미 종료된 시험입니다.' });
		if (state === 'expired') {
			await closeAttempt(attemptId, true);
			return fail(409, { message: '이미 시험 시간이 종료되었습니다.' });
		}
		return {
			success:
				state === 'paused' ? '이미 일시 중지된 시험입니다.' : '시험 시간을 일시 중지했습니다.'
		};
	},
	resumeAttempt: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const attemptId = String(data.get('id'));
		const state = await database().transaction(async (tx) => {
			const [attempt] = await tx
				.select()
				.from(attempts)
				.where(eq(attempts.id, attemptId))
				.for('update');
			if (!attempt) return 'missing' as const;
			if (attempt.submittedAt) return 'submitted' as const;
			if (!attempt.pausedAt) return 'running' as const;
			const now = new Date();
			const pausedDuration = Math.max(0, now.getTime() - attempt.pausedAt.getTime());
			await tx
				.update(attempts)
				.set({
					pausedAt: null,
					expiresAt: new Date(attempt.expiresAt.getTime() + pausedDuration)
				})
				.where(eq(attempts.id, attempt.id));
			return 'updated' as const;
		});
		if (state === 'missing') return fail(404, { message: '응시 기록을 찾지 못했습니다.' });
		if (state === 'submitted') return fail(409, { message: '이미 종료된 시험입니다.' });
		return {
			success: state === 'running' ? '이미 진행 중인 시험입니다.' : '시험 시간을 다시 시작했습니다.'
		};
	},
	extendAttempt: async (event) => {
		admin(event);
		const data = await event.request.formData();
		const attemptId = String(data.get('id'));
		const minutes = Number(data.get('minutes'));
		if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
			return fail(400, { message: '추가 시간은 1분부터 180분까지 입력해 주세요.' });
		}
		const now = new Date();
		const state = await database().transaction(async (tx) => {
			const [attempt] = await tx
				.select()
				.from(attempts)
				.where(eq(attempts.id, attemptId))
				.for('update');
			if (!attempt) return 'missing' as const;
			if (attempt.submittedAt) return 'submitted' as const;
			if (!attempt.pausedAt && attempt.expiresAt <= now) return 'expired' as const;
			await tx
				.update(attempts)
				.set({ expiresAt: new Date(attempt.expiresAt.getTime() + minutes * 60_000) })
				.where(eq(attempts.id, attempt.id));
			return 'updated' as const;
		});
		if (state === 'missing') return fail(404, { message: '응시 기록을 찾지 못했습니다.' });
		if (state === 'submitted') return fail(409, { message: '이미 종료된 시험입니다.' });
		if (state === 'expired') {
			await closeAttempt(attemptId, true);
			return fail(409, { message: '이미 시험 시간이 종료되었습니다.' });
		}
		return { success: `시험 시간을 ${minutes}분 연장했습니다.` };
	},
	gradeAll: async (event) => {
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
		const scores: Array<{ questionId: string; score: number }> = [];
		for (const question of subjectiveQuestions) {
			const raw = String(data.get(`score-${question.id}`) ?? '').trim();
			if (!raw) continue;
			const score = Number(raw);
			if (!Number.isFinite(score) || score < 0) {
				return fail(400, { message: `문제 ${question.sortOrder}의 점수를 확인해 주세요.` });
			}
			scores.push({ questionId: question.id, score });
		}
		if (!scores.length) return fail(400, { message: '저장할 점수를 하나 이상 입력해 주세요.' });

		try {
			await db.transaction(async (tx) => {
				const [lockedAttempt] = await tx
					.select()
					.from(attempts)
					.where(eq(attempts.id, attemptId))
					.for('update');
				if (!lockedAttempt?.submittedAt) throw new Error('채점할 응시 기록이 종료되지 않았습니다.');
				for (const item of scores) {
					await tx
						.insert(answers)
						.values({ attemptQuestionId: item.questionId, value: '', score: item.score })
						.onConflictDoUpdate({
							target: answers.attemptQuestionId,
							set: { score: item.score, updatedAt: new Date() }
						});
				}
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
			});
		} catch (cause) {
			console.error('[admin:gradeAll] failed', {
				attemptId,
				error: cause instanceof Error ? cause.message : String(cause)
			});
			return fail(500, { message: '채점 점수를 저장하지 못했습니다. 다시 시도해 주세요.' });
		}
		return { success: `${scores.length}개 문항의 채점 점수를 저장했습니다.` };
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
