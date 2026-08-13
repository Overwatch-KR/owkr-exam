import {error} from '@sveltejs/kit';
import type {RequestEvent} from '@sveltejs/kit';

export function user(e: RequestEvent) {
		if (!e.locals.user) throw error(401, '로그인이 필요합니다.');
		return e.locals.user
}

export function admin(e: RequestEvent) {
		if (!e.locals.isAdmin) throw error(403, '관리자 권한이 없습니다.');
		return user(e)
}
