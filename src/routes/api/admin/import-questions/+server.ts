import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { database } from '$lib/server/db';
import { questions } from '$lib/server/schema';

const question = z
	.object({
		type: z.enum(['multiple', 'short', 'essay']),
		content: z.string().trim().min(1).max(20_000),
		options: z.array(z.string().trim().min(1)).min(2).max(10).nullable(),
		correctAnswer: z.number().int().nonnegative().nullable(),
		points: z.number().int().positive().max(100),
		sortOrder: z.number().int().positive()
	})
	.superRefine((value, context) => {
		if (value.type === 'multiple') {
			if (!value.options || value.correctAnswer === null) {
				context.addIssue({ code: 'custom', message: '객관식 보기와 정답이 필요합니다.' });
			} else if (value.correctAnswer >= value.options.length) {
				context.addIssue({ code: 'custom', message: '객관식 정답 번호가 보기 범위를 벗어났습니다.' });
			}
		} else if (value.options !== null || value.correctAnswer !== null) {
			context.addIssue({ code: 'custom', message: '주관식에는 보기와 객관식 정답을 넣을 수 없습니다.' });
		}
	});

const input = z.object({
	replace: z.boolean().default(false),
	questions: z.array(question).min(1).max(100)
});

function authorized(header: string | null) {
	const secret = process.env.QUESTION_IMPORT_TOKEN;
	const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
	if (!secret || !supplied) return false;
	const expected = Buffer.from(secret);
	const actual = Buffer.from(supplied);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const POST = async (event) => {
	if (!authorized(event.request.headers.get('authorization'))) {
		return json({ message: 'Not found' }, { status: 404 });
	}

	const parsed = input.safeParse(await event.request.json());
	if (!parsed.success) {
		return json({ message: '문항 데이터가 올바르지 않습니다.' }, { status: 400 });
	}

	const db = database();
	const result = await db.transaction(async (transaction) => {
		const existing = await transaction.select().from(questions);
		const byContent = new Map(existing.map((item) => [item.content, item]));
		let inserted = 0;
		let updated = 0;

		if (parsed.data.replace) await transaction.update(questions).set({ active: false });
		for (const seed of parsed.data.questions) {
			const match = byContent.get(seed.content);
			if (match) {
				await transaction
					.update(questions)
					.set({ ...seed, active: true })
					.where(eq(questions.id, match.id));
				updated += 1;
			} else {
				await transaction.insert(questions).values({ ...seed, active: true });
				inserted += 1;
			}
		}

		return { inserted, updated };
	});

	return json({
		...result,
		active: parsed.data.questions.length,
		points: parsed.data.questions.reduce((sum, item) => sum + item.points, 0)
	});
};
