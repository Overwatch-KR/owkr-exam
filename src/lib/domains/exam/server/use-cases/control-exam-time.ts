import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { attempts } from '$lib/server/schema';
import { closeAttempt } from '../close-attempt';
import { ExamRequestError } from '../errors';
import { getExamStatus } from './get-exam-status';
import type { ExamUser } from '../user';
import type { ControlExamTimeMutationInput } from '../../shared/public';
export async function controlExamTime(
	{ attemptId, action }: ControlExamTimeMutationInput,
	currentUser: ExamUser
) {
	const expired = await database().transaction(async (tx) => {
		const [attempt] = await tx
			.select()
			.from(attempts)
			.where(and(eq(attempts.id, attemptId), eq(attempts.discordId, currentUser.id)))
			.for('update');
		if (!attempt) throw new ExamRequestError(404, '응시 기록을 찾을 수 없습니다.');
		if (attempt.submittedAt) throw new ExamRequestError(409, '이미 종료된 시험입니다.');
		const now = new Date();
		if (!attempt.pausedAt && attempt.expiresAt <= now) return true;
		if (action === 'pause' && !attempt.pausedAt)
			await tx.update(attempts).set({ pausedAt: now }).where(eq(attempts.id, attempt.id));
		if (action === 'resume' && attempt.pausedAt)
			await tx
				.update(attempts)
				.set({
					pausedAt: null,
					expiresAt: new Date(
						attempt.expiresAt.getTime() + Math.max(0, now.getTime() - attempt.pausedAt.getTime())
					)
				})
				.where(eq(attempts.id, attempt.id));
		return false;
	});
	if (expired) {
		await closeAttempt(attemptId, true);
		throw new ExamRequestError(409, '시험 시간이 종료되었습니다.');
	}
	return getExamStatus({ attemptId }, currentUser);
}
