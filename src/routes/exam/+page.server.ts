import { redirect } from '@sveltejs/kit'; export const load=({locals})=>{if(!locals.user)throw redirect(303,'/');return {user:locals.user};}; export const prerender=false;
