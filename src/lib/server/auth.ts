import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

export type User = { id: string; username: string; displayName: string; avatar: string | null };
const secret = () => {
	if (env.SESSION_SECRET) return env.SESSION_SECRET;
	if (dev) return 'development-only-change-me';
	throw new Error('SESSION_SECRET 환경변수가 필요합니다.');
};
const localAuthHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
export const localAdminUser: User = {
	id: 'owkr-local-admin',
	username: 'local-admin',
	displayName: '로컬 관리자',
	avatar: null
};
export const isAdmin = (id: string) =>
	(env.ADMIN_DISCORD_IDS || '')
		.split(',')
		.map((value) => value.trim())
		.includes(id);

export function isLocalAuthRequest(url: URL) {
	return (
		env.OWKR_LOCAL_AUTH_BYPASS === 'true' &&
		dev &&
		localAuthHostnames.has(url.hostname.toLowerCase())
	);
}

export function sign(value: string) {
	return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function setSession(cookies: Cookies, user: User) {
	const raw = Buffer.from(JSON.stringify(user)).toString('base64url');
	cookies.set('owkr_session', `${raw}.${sign(raw)}`, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7
	});
}

export function getSession(cookies: Cookies): User | null {
	const value = cookies.get('owkr_session');
	if (!value) return null;
	const [raw, signature] = value.split('.');
	if (!raw || !signature) return null;
	try {
		if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(raw)))) return null;
		return JSON.parse(Buffer.from(raw, 'base64url').toString());
	} catch {
		return null;
	}
}

export function oauthState() {
	return randomBytes(24).toString('base64url');
}
