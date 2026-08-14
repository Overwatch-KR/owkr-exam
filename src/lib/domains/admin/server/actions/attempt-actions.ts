import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { closeAttempt } from '$lib/domains/exam/server/public';
import { admin } from '$lib/server/guard';
import { attempts, examCodes } from '$lib/server/schema';
import type { AdminAction } from './types';

const pauseAttempt: AdminAction = async (event) => {
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
		success: state === 'paused' ? '이미 일시 중지된 시험입니다.' : '시험 시간을 일시 중지했습니다.'
	};
};

const resumeAttempt: AdminAction = async (event) => {
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
};

const extendAttempt: AdminAction = async (event) => {
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
};

const deleteAttempt: AdminAction = async (event) => {
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
};

export const attemptActions: Record<string, AdminAction> = {
	pauseAttempt,
	resumeAttempt,
	extendAttempt,
	deleteAttempt
};
