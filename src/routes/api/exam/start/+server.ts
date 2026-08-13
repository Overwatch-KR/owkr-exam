import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { attempts, examCodes, examQuestions, questions, answers } from '$lib/server/schema';
import { user } from '$lib/server/guard';

const input = z.object({
	code: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z0-9]{6}$/)
});
export const POST = async (e) => {
	const u = user(e);
	const parsed = input.safeParse(await e.request.json());
	if (!parsed.success)
		return json({ message: '올바른 6자리 코드를 입력해 주세요.' }, { status: 400 });
	const db = database();
	try {
		return await db.transaction(async (tx) => {
			const [code] = await tx
				.select()
				.from(examCodes)
				.where(eq(examCodes.code, parsed.data.code))
				.for('update');
			if (!code) return json({ message: '존재하지 않는 코드입니다.' }, { status: 404 });
			if (code.discordId !== u.id)
				return json({ message: '다른 Discord 계정에 발급된 코드입니다.' }, { status: 403 });
			let [a] = await tx.select().from(attempts).where(eq(attempts.codeId, code.id));
			if (!a) {
				if (code.status !== 'unused')
					return json({ message: '이미 사용되었거나 만료된 코드입니다.' }, { status: 409 });
				const now = new Date(),
					expires = new Date(now.getTime() + 3600000);
				[a] = await tx
					.insert(attempts)
					.values({
						codeId: code.id,
						discordId: u.id,
						username: u.username,
						displayName: u.displayName,
						avatar: u.avatar,
						startedAt: now,
						expiresAt: expires
					})
					.returning();
				const qs = await tx
					.select()
					.from(questions)
					.where(eq(questions.active, true))
					.orderBy(asc(questions.sortOrder));
				if (!qs.length) return json({ message: '등록된 활성 문제가 없습니다.' }, { status: 400 });
				const snapshot = await tx
					.insert(examQuestions)
					.values(
						qs.map((q) => ({
							attemptId: a.id,
							sourceQuestionId: q.id,
							type: q.type,
							content: q.content,
							options: q.options,
							correctAnswer: q.correctAnswer,
							points: q.points,
							sortOrder: q.sortOrder
						}))
					)
					.returning();
				await tx
					.update(examCodes)
					.set({
						status: 'in_progress',
						startedAt: now
					})
					.where(eq(examCodes.id, code.id));
			}
			if (a.submittedAt) return json({ message: '이미 제출된 시험입니다.' }, { status: 409 });
			const qs = await tx
				.select()
				.from(examQuestions)
				.where(eq(examQuestions.attemptId, a.id))
				.orderBy(asc(examQuestions.sortOrder));
			const old = await tx
				.select()
				.from(answers)
				.where(eq(answers.attemptQuestionId, qs[0]?.id || ''));
			return json({
				id: a.id,
				expiresAt: a.expiresAt,
				questions: qs.map((q) => ({
					id: q.id,
					type: q.type,
					content: q.content,
					options: q.options,
					points: q.points,
					answer: old.find((x) => x.attemptQuestionId === q.id)?.value || ''
				}))
			});
		});
	} catch (err) {
		console.error(err);
		return json({ message: '시험을 시작하지 못했습니다.' }, { status: 500 });
	}
};
