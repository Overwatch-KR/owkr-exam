import { redirect } from '@sveltejs/kit'; export const POST=({cookies})=>{cookies.delete('owkr_session',{path:'/'});throw redirect(303,'/')};
