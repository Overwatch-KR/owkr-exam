import { json } from '@sveltejs/kit';
import { executeContract, implementQuery } from 'boundra';
import { and, eq } from 'drizzle-orm';
import { getExamStatusQuery } from '$lib/domains/exam/shared/public';
import { ExamRequestError, examRequestError } from '$lib/domains/exam/server/public';
import { database } from '$lib/server/db';
import { attempts } from '$lib/server/schema';
import { user } from '$lib/server/guard';
import { closeAttempt } from '$lib/server/exam';

export const POST = async (event) => {
	const currentUser = user(event);
	try {
		const result = await executeContract(
			implementQuery(getExamStatusQuery, async ({ attemptId }) => {
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
			}),
			await event.request.json()
		);
		return json(result);
	} catch (error) {
		const requestError = examRequestError(error, '시험 상태 정보가 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '시험 상태를 확인하지 못했습니다.' }, { status: 500 });
	}
};
