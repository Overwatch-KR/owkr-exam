import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'; import type { Cookies } from '@sveltejs/kit';
export type User={id:string;username:string;displayName:string;avatar:string|null}; const secret=()=>process.env.SESSION_SECRET||'development-only-change-me';
const localAuthHostnames=new Set(['localhost','127.0.0.1','[::1]']);
export const localAdminUser:User={id:'owkr-local-admin',username:'local-admin',displayName:'로컬 관리자',avatar:null};
export const isAdmin=(id:string)=> (process.env.ADMIN_DISCORD_IDS||'').split(',').map(x=>x.trim()).includes(id);
export function isLocalAuthRequest(url:URL){return process.env.OWKR_LOCAL_AUTH_BYPASS==='true'&&process.env.NODE_ENV!=='production'&&localAuthHostnames.has(url.hostname.toLowerCase())}
export function sign(v:string){return createHmac('sha256',secret()).update(v).digest('base64url')}; export function setSession(c:Cookies,u:User){const raw=Buffer.from(JSON.stringify(u)).toString('base64url');c.set('owkr_session',raw+'.'+sign(raw),{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:60*60*24*7});}
export function getSession(c:Cookies):User|null{const v=c.get('owkr_session');if(!v)return null;const [raw,s]=v.split('.');if(!raw||!s)return null;try{if(!timingSafeEqual(Buffer.from(s),Buffer.from(sign(raw))))return null;return JSON.parse(Buffer.from(raw,'base64url').toString())}catch{return null}}
export function oauthState(){return randomBytes(24).toString('base64url')}
