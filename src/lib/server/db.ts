import { drizzle } from 'drizzle-orm/postgres-js'; import postgres from 'postgres'; import * as schema from './schema';
const url=process.env.DATABASE_URL; export const db=url?drizzle(postgres(url),{schema}):null;
export function database(){if(!db) throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.'); return db;}
