import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { admin } from '$lib/server/guard';
import { examCodes } from '$lib/server/schema';
import type { AdminAction } from './types';

const codeCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () =>
	Array.from(
		{ length: 6 },
		() => codeCharacters[Math.floor(Math.random() * codeCharacters.length)]
	).join('');

const createCode: AdminAction = async (event) => {
	admin(event);
	const data = await event.request.formData();
	const discordId = String(data.get('discordId')).trim();
	if (!/^\d{10,30}$/.test(discordId)) {
		return fail(400, { message: 'Discord User ID를 확인해 주세요.' });
	}
	const db = database();
	for (let index = 0; index < 5; index += 1) {
		try {
			await db.insert(examCodes).values({ code: makeCode(), discordId });
			return { success: '응시 코드를 생성했습니다.' };
		} catch {
			// 코드 충돌 시 새 값으로 다시 시도합니다.
		}
	}
	return fail(500, { message: '코드 생성에 실패했습니다. 다시 시도해 주세요.' });
};

const expireCode: AdminAction = async (event) => {
	admin(event);
	const data = await event.request.formData();
	const id = String(data.get('id'));
	const [code] = await database().select().from(examCodes).where(eq(examCodes.id, id));
	if (!code) return fail(404, { message: '폐기할 응시 코드를 찾지 못했습니다.' });
	if (code.reusable) return fail(400, { message: '반복 사용 테스트 코드는 폐기할 수 없습니다.' });
	await database().update(examCodes).set({ status: 'expired' }).where(eq(examCodes.id, id));
	return { success: '코드를 폐기했습니다.' };
};

export const codeActions: Record<string, AdminAction> = {
	code: createCode,
	expireCode
};
