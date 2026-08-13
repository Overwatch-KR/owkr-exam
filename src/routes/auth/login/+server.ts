import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import {redirect} from '@sveltejs/kit';
import {isLocalAuthRequest, oauthState} from '$lib/server/auth';

export const GET = ({cookies, url}) => {
		if (isLocalAuthRequest(url)) throw redirect(302, '/admin');
		const state = oauthState();
		cookies.set('discord_oauth_state', state, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				maxAge: 600
		});
		const params = new URLSearchParams({
				client_id: env.DISCORD_CLIENT_ID || '',
				redirect_uri: env.DISCORD_REDIRECT_URI || '',
				response_type: 'code',
				scope: 'identify',
				state
		});
		throw redirect(302, `https://discord.com/oauth2/authorize?${params}`);
};
