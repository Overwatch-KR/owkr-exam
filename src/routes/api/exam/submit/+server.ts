import {json} from '@sveltejs/kit';
import {eq} from 'drizzle-orm';
import {database} from '$lib/server/db';
import {attempts, examQuestions} from '$lib/server/schema';
import {user} from '$lib/server/guard';
import {closeAttempt} from '$lib/server/exam';

export const POST = async (event) => {
		const currentUser = user(event);
		const body = await event.request.json();
		const db = database();
		const [attempt] = await db
				.select()
				.from(attempts)
				.where(eq(attempts.id, body.attemptId));
		if (!attempt || attempt.discordId !== currentUser.id) {
				return json({message: '진행 중인 시험이 없습니다.'}, {status: 404});
		}

		const completed = await closeAttempt(attempt.id, attempt.expiresAt <= new Date());
		const questions = await db
				.select({type: examQuestions.type, points: examQuestions.points})
				.from(examQuestions)
				.where(eq(examQuestions.attemptId, attempt.id));
		const objectiveMaxScore = questions
				.filter((question) => question.type === 'multiple')
				.reduce((sum, question) => sum + question.points, 0);

		return json({
				submittedAt: completed?.submittedAt,
				objectiveScore: completed?.objectiveScore ?? 0,
				objectiveMaxScore
		});
};
