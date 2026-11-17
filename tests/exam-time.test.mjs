import { build } from 'esbuild';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const repo = process.cwd();
const cache = repo + '/node_modules/.cache/owkr-exam-tests';
fs.mkdirSync(cache, { recursive: true });
const out = cache + '/time-bundle.mjs';
await build({
	stdin: {
		contents: `export { closeAttempt } from '${repo}/src/lib/domains/exam/server/close-attempt.ts'; export { submitExam } from '${repo}/src/lib/domains/exam/server/use-cases/submit-exam.ts'; export { gradingActions } from '${repo}/src/lib/domains/admin/server/actions/grading-actions.ts'; export { controlExamTime } from '${repo}/src/lib/domains/exam/server/use-cases/control-exam-time.ts'; export { attemptActions } from '${repo}/src/lib/domains/admin/server/actions/attempt-actions.ts'; export { startExam } from '${repo}/src/lib/domains/exam/server/use-cases/start-exam.ts'; export { controlExamTimeInputSchema } from '${repo}/src/lib/domains/exam/shared/contracts/control-exam-time.ts';`,
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
				b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
					contents: args.path.endsWith('/db')
						? 'export const database=()=>globalThis.timeTestDb;'
						: args.path.endsWith('/guard')
							? 'export function admin(event){if(!event.locals?.isAdmin)throw new Error("forbidden");}'
							: 'export { closeAttempt } from ' +
								JSON.stringify(repo + '/src/lib/domains/exam/server/close-attempt.ts') +
								';',
					loader: 'js',
					resolveDir: repo
				}));
			}
		}
	]
});
const {
	controlExamTime,
	attemptActions,
	startExam,
	closeAttempt,
	submitExam,
	gradingActions,
	controlExamTimeInputSchema
} = await import(out);
const { getTableName } = await import('drizzle-orm');
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
	beforeLock,
	fixtureQuestions = [],
	fixtureAnswers = [],
	writes = 0,
	checks = 0;
const reset = (overrides = {}) => {
	row = {
		id: 'attempt',
		codeId: 'code',
		objectiveScore: 0,
		discordId: 'owner',
		expiresAt: new Date(now + 600000),
		pausedAt: null,
		submittedAt: null,
		addedMinutes: 0,
		...overrides
	};
	beforeLock = undefined;
	fixtureQuestions = [];
	fixtureAnswers = [];
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
			from(table) {
				const name = getTableName(table);
				const query = {
					where(condition) {
						if (name === 'exam_questions') return Promise.resolve(fixtureQuestions);
						if (name === 'answers') return Promise.resolve(fixtureAnswers);
						const result = Promise.resolve(matching(condition));
						result.for = async () => {
							locked = true;
							beforeLock?.();
							beforeLock = undefined;
							return matching(condition);
						};
						return result;
					},
					leftJoin() {
						return {
							where: async () =>
								fixtureQuestions.map((q) => ({
									...q,
									value: fixtureAnswers.find((a) => a.attemptQuestionId === q.id)?.value ?? null
								}))
						};
					}
				};
				return query;
			}
		};
	},
	update(table) {
		return {
			set(data) {
				return {
					where() {
						assert.ok(locked, 'writes require row lock');
						if (getTableName(table) === 'exam_attempts') {
							Object.assign(row, data);
							writes++;
						}
						const result = Promise.resolve();
						result.returning = async () => [row];
						return result;
					}
				};
			}
		};
	},
	insert() {
		return {
			values(data) {
				return {
					async onConflictDoUpdate({ set }) {
						assert.ok(locked, 'writes require row lock');
						const answer = fixtureAnswers.find(
							(item) => item.attemptQuestionId === data.attemptQuestionId
						);
						if (answer) Object.assign(answer, set);
						else fixtureAnswers.push(data);
					}
				};
			}
		};
	},
	async transaction(fn) {
		locked = false;
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
	assert.equal(writes, 1);
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
	assert.equal(writes, 1);
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

	reset();
	beforeLock = () => (row.pausedAt = new Date(now));
	await assert.rejects(submitExam({ attemptId: 'attempt' }, user), (e) => e.status === 409);
	assert.equal(row.submittedAt, null);
	assert.equal(writes, 0);
	checks++;

	reset({ expiresAt: new Date(now - 1) });
	beforeLock = () => (row.expiresAt = new Date(now + 60000));
	await assert.rejects(
		submitExam({ attemptId: 'attempt', timeout: true }, user),
		(e) => e.status === 409
	);
	assert.equal(row.submittedAt, null);
	assert.equal(writes, 0);
	checks++;

	reset();
	beforeLock = () => (row.expiresAt = new Date(now));
	fixtureQuestions = [
		{ id: 'one', type: 'multiple', correctAnswer: 0, points: 2 },
		{ id: 'two', type: 'short', points: 3 }
	];
	fixtureAnswers = [{ attemptQuestionId: 'one', value: '0' }];
	const receipt = await submitExam({ attemptId: 'attempt' }, user);
	assert.equal(receipt.timedOut, true);
	assert.equal(receipt.objectiveScore, 2);
	assert.equal(receipt.answeredCount, 1);
	assert.equal(receipt.questionCount, 2);
	assert.deepEqual(await submitExam({ attemptId: 'attempt' }, user), receipt);
	assert.equal(writes, 1);
	checks++;

	reset({ pausedAt: new Date(now), expiresAt: new Date(now - 1) });
	await closeAttempt('attempt', true);
	assert.equal(writes, 0);
	checks++;

	reset({ submittedAt: new Date(now), objectiveScore: 2 });
	fixtureQuestions = [
		{ id: 'one', type: 'short', points: 5, sortOrder: 20 },
		{ id: 'two', type: 'short', points: 5, sortOrder: 21 }
	];
	fixtureAnswers = [{ attemptQuestionId: 'one', value: 'answer', score: 4 }];
	const fields = {
		attemptId: 'attempt',
		'score-one': '3',
		'base-one': '2',
		'score-two': '5',
		'base-two': ''
	};
	const conflict = await gradingActions.gradeAll(form(fields));
	assert.equal(conflict.status, 409);
	assert.equal(conflict.data.gradeConflicts[0].current, 4);
	assert.equal(fixtureAnswers.length, 1);
	assert.equal(writes, 0);
	const saved = await gradingActions.gradeAll(form({ ...fields, 'score-one': '2' }));
	assert.ok(saved.success);
	assert.equal(fixtureAnswers[0].score, 4);
	assert.equal(fixtureAnswers[1].score, 5);
	assert.equal(row.totalScore, 11);
	checks++;

	console.log(
		'시험 시간 회귀 검사 ' +
			checks +
			'개 통과: 소유자·관리자 권한, 만료·제출 잠금, 정지·재개 멱등성, 정지 시간 보존, 연장 누적·입력 범위'
	);
} finally {
	globalThis.Date = realDate;
}
