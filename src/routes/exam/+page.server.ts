import { redirect } from '@sveltejs/kit'; export const load=({locals})=>{if(!locals.user)throw redirect(303,'/');return {user:locals.user,isAdmin:locals.isAdmin};}; export const prerender=false;
