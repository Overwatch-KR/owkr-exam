import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { setSession } from '$lib/server/auth';

export const GET = async ({ url, cookies, fetch }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expected = cookies.get('discord_oauth_state');
	cookies.delete('discord_oauth_state', { path: '/' });
	if (!code || !state || state !== expected) {
		throw error(400, '로그인 요청을 확인할 수 없습니다. 다시 시도해 주세요.');
	}
	const body = new URLSearchParams({
		client_id: env.DISCORD_CLIENT_ID || '',
		client_secret: env.DISCORD_CLIENT_SECRET || '',
		grant_type: 'authorization_code',
		code,
		redirect_uri: env.DISCORD_REDIRECT_URI || ''
	});
	const token = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		body,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
	});
	if (!token.ok) throw error(401, 'Discord 로그인에 실패했습니다.');
	const data = await token.json();
	const me = await fetch('https://discord.com/api/users/@me', {
		headers: { Authorization: `Bearer ${data.access_token}` }
	});
	if (!me.ok) throw error(401, 'Discord 사용자 정보를 가져오지 못했습니다.');
	const user = await me.json();
	setSession(cookies, {
		id: user.id,
		username: user.username,
		displayName: user.global_name || user.username,
		avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
	});
	throw redirect(303, '/');
};
