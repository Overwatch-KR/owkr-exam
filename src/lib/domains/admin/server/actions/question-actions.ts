import { fail } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { invalidateExamConfig } from '$lib/domains/exam/server/public';
import { admin } from '$lib/server/guard';
import { questions } from '$lib/server/schema';
import type { AdminAction } from './types';

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

const createQuestion: AdminAction = async (event) => {
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
};

const updateQuestion: AdminAction = async (event) => {
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
};

const deleteQuestion: AdminAction = async (event) => {
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
};

export const questionActions: Record<string, AdminAction> = {
	question: createQuestion,
	updateQuestion,
	deleteQuestion
};
