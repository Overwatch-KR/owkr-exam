import { build } from 'esbuild';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const repo = process.cwd();
const cache = repo + '/node_modules/.cache/owkr-exam-tests';
fs.mkdirSync(cache, { recursive: true });
const out = cache + '/time-bundle.mjs';
await build({
	stdin: {
		contents: `export { controlExamTime } from '${repo}/src/lib/domains/exam/server/use-cases/control-exam-time.ts'; export { attemptActions } from '${repo}/src/lib/domains/admin/server/actions/attempt-actions.ts'; export { startExam } from '${repo}/src/lib/domains/exam/server/use-cases/start-exam.ts'; export { controlExamTimeInputSchema } from '${repo}/src/lib/domains/exam/shared/contracts/control-exam-time.ts';`,
		resolveDir: repo,
		loader: 'ts'
	},
	outfile: out,
	bundle: true,
	platform: 'node',
	format: 'esm',
	packages: 'external',
	plugins: [
		{
			name: 'time-fixture',
			setup(b) {
				b.onResolve({ filter: /^\$lib\// }, (args) =>
					args.path.endsWith('/db') ||
					args.path.endsWith('/guard') ||
					args.path.includes('/exam/server/public')
						? { path: args.path, namespace: 'fixture' }
						: { path: repo + '/src/lib/' + args.path.slice(5) + '.ts' }
				);
				b.onResolve({ filter: /close-attempt$/ }, () => ({ path: 'close', namespace: 'fixture' }));
				b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
					contents: args.path.endsWith('/db')
						? 'export const database=()=>globalThis.timeTestDb;'
						: args.path.endsWith('/guard')
							? 'export function admin(event){if(!event.locals?.isAdmin)throw new Error("forbidden");}'
							: 'export async function closeAttempt(id){globalThis.timeTestRow.submittedAt=new Date();globalThis.timeTestRow.timedOut=true;}',
					loader: 'js'
				}));
			}
		}
	]
});
const { controlExamTime, attemptActions, startExam, controlExamTimeInputSchema } = await import(
	out
);
const { PgDialect } = await import('drizzle-orm/pg-core');
const dialect = new PgDialect();
const realDate = Date;
const now = Date.parse('2026-10-20T12:00:00Z');
globalThis.Date = class extends realDate {
	constructor(...args) {
		super(...(args.length ? args : [now]));
	}
	static now() {
		return now;
	}
};
let row,
	locked = false,
	writes = 0,
	checks = 0;
const reset = (overrides = {}) => {
	row = {
		id: 'attempt',
		discordId: 'owner',
		expiresAt: new Date(now + 600000),
		pausedAt: null,
		submittedAt: null,
		addedMinutes: 0,
		...overrides
	};
	globalThis.timeTestRow = row;
	writes = 0;
	locked = false;
};
const matching = (condition) => {
	const params = dialect.sqlToQuery(condition).params;
	return params.every((p) => p === row.id || p === row.discordId) ? [row] : [];
};
const db = {
	select() {
		return {
			from() {
				return {
					where(condition) {
						const result = Promise.resolve(matching(condition));
						result.for = async () => {
							locked = true;
							return matching(condition);
						};
						return result;
					}
				};
			}
		};
	},
	update() {
		return {
			set(data) {
				return {
					where: async () => {
						assert.ok(locked, 'writes require row lock');
						Object.assign(row, data);
						writes++;
					}
				};
			}
		};
	},
	async transaction(fn) {
		return fn(db);
	}
};
globalThis.timeTestDb = db;
const user = { id: 'owner', username: 'owner', displayName: 'Owner', avatar: null };
const control = (action, id = 'attempt', current = user) =>
	controlExamTime({ attemptId: id, action }, current);
const form = (fields, admin = true) => ({
	locals: { isAdmin: admin },
	request: {
		formData: async () => {
			const data = new FormData();
			for (const [k, v] of Object.entries(fields)) data.set(k, v);
			return data;
		}
	}
});
try {
	reset();
	await control('pause');
	assert.equal(row.pausedAt.getTime(), now);
	assert.equal(writes, 1);
	await control('pause');
	assert.equal(writes, 1);
	checks++;
	reset({ pausedAt: new Date(now - 120000) });
	await control('resume');
	assert.equal(row.expiresAt.getTime(), now + 720000);
	assert.equal(row.pausedAt, null);
	await control('resume');
	assert.equal(writes, 1);
	checks++;
	reset();
	await assert.rejects(
		control('pause', 'attempt', { ...user, id: 'other' }),
		(e) => e.status === 404
	);
	assert.equal(writes, 0);
	checks++;
	reset({ submittedAt: new Date(now - 1000) });
	await assert.rejects(control('resume'), (e) => e.status === 409);
	assert.equal(writes, 0);
	checks++;
	reset({ expiresAt: new Date(now - 1) });
	await assert.rejects(control('pause'), (e) => e.status === 409);
	assert.equal(row.timedOut, true);
	assert.equal(writes, 0);
	checks++;
	reset({ expiresAt: new Date(now - 10000), pausedAt: new Date(now - 60000) });
	await control('resume');
	assert.equal(row.expiresAt.getTime(), now + 50000);
	checks++;
	reset({ pausedAt: new Date(now - 120000) });
	await attemptActions.extendAttempt(form({ id: 'attempt', minutes: '5' }));
	assert.equal(row.addedMinutes, 5);
	assert.equal(row.expiresAt.getTime(), now + 900000);
	await control('resume');
	assert.equal(row.expiresAt.getTime(), now + 1020000);
	assert.equal(row.addedMinutes, 5);
	checks++;
	reset();
	for (const minutes of ['0', '181', '1.5', 'NaN'])
		assert.equal(
			(await attemptActions.extendAttempt(form({ id: 'attempt', minutes }))).status,
			400
		);
	assert.equal(writes, 0);
	checks++;
	reset();
	await assert.rejects(
		attemptActions.extendAttempt(form({ id: 'attempt', minutes: '5' }, false)),
		/forbidden/
	);
	assert.equal(writes, 0);
	checks++;
	reset();
	await attemptActions.pauseAttempt(form({ id: 'attempt' }));
	assert.equal(row.pausedAt.getTime(), now);
	await control('resume');
	assert.equal(row.pausedAt, null);
	checks++;
	reset();
	await control('pause');
	await attemptActions.resumeAttempt(form({ id: 'attempt' }));
	assert.equal(row.pausedAt, null);
	checks++;
	reset({ expiresAt: new Date(now - 1) });
	assert.equal(
		(await attemptActions.extendAttempt(form({ id: 'attempt', minutes: '5' }))).status,
		409
	);
	assert.equal(writes, 0);
	checks++;
	assert.equal(
		controlExamTimeInputSchema.safeParse({
			attemptId: '00000000-0000-4000-8000-000000000001',
			action: 'extend',
			minutes: 5
		}).success,
		false
	);
	checks++;
	reset({ pausedAt: new Date(now - 60000) });
	const originalDb = globalThis.timeTestDb;
	let reads = 0;
	const pausedStartDb = {
		async transaction(fn) {
			return fn(this);
		},
		select() {
			return {
				from() {
					return {
						where() {
							reads++;
							const rows =
								reads === 1
									? [{ id: 'code', discordId: 'owner' }]
									: reads === 2
										? [row]
										: reads === 3
											? [
													{
														id: 'question',
														type: 'multiple',
														content: 'HIDDEN',
														options: ['HIDDEN OPTION'],
														correctAnswer: 0,
														correctAnswers: [0],
														points: 2
													}
												]
											: [{ attemptQuestionId: 'question', value: 'HIDDEN ANSWER' }];
							const result = Promise.resolve(rows);
							result.for = async () => rows;
							result.orderBy = async () => rows;
							return result;
						}
					};
				}
			};
		}
	};
	globalThis.timeTestDb = pausedStartDb;
	const pausedStart = await startExam({ code: 'ABC123' }, user);
	assert.deepEqual(pausedStart.questions, []);
	assert.ok(pausedStart.pausedAt);
	assert.ok(!JSON.stringify(pausedStart).includes('HIDDEN'));
	checks++;
	globalThis.timeTestDb = originalDb;

	console.log(
		'시험 시간 회귀 검사 ' +
			checks +
			'개 통과: 소유자·관리자 권한, 만료·제출 잠금, 정지·재개 멱등성, 정지 시간 보존, 연장 누적·입력 범위'
	);
} finally {
	globalThis.Date = realDate;
}
