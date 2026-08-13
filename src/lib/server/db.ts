import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const dbUrl = env.DATABASE_URL;
export const db = dbUrl ? drizzle(postgres(dbUrl), { schema }) : null;

export function database() {
	if (!db) throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
	return db;
}
