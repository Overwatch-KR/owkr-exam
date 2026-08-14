import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { attempts } from '$lib/server/schema';
import { closeAttempt } from '../close-attempt';
import type { GetExamStatusQueryInput, GetExamStatusQueryResult } from '../../shared/public';
import { ExamRequestError } from '../errors';
import type { ExamUser } from '../user';

export async function getExamStatus(
	{ attemptId }: GetExamStatusQueryInput,
	currentUser: ExamUser
): Promise<GetExamStatusQueryResult> {
	const db = database();
	let [attempt] = await db
		.select()
		.from(attempts)
		.where(and(eq(attempts.id, attemptId), eq(attempts.discordId, currentUser.id)));
	if (!attempt) throw new ExamRequestError(404, '응시 기록을 찾을 수 없습니다.');

	const now = new Date();
	if (!attempt.submittedAt && !attempt.pausedAt && attempt.expiresAt <= now) {
		await closeAttempt(attempt.id, true);
		[attempt] = await db.select().from(attempts).where(eq(attempts.id, attempt.id));
	}
	return {
		expiresAt: attempt.expiresAt.toISOString(),
		pausedAt: attempt.pausedAt?.toISOString() ?? null,
		submittedAt: attempt.submittedAt?.toISOString() ?? null,
		timedOut: attempt.timedOut,
		serverNow: now.toISOString()
	};
}
