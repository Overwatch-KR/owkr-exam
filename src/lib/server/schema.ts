import {
	pgTable,
	text,
	timestamp,
	integer,
	numeric,
	jsonb,
	boolean,
	uuid,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';

export const questions = pgTable('questions', {
	id: uuid('id').defaultRandom().primaryKey(),
	type: text('type').notNull(),
	content: text('content').notNull(),
	options: jsonb('options').$type<string[]>(),
	correctAnswer: integer('correct_answer'),
	correctAnswers: jsonb('correct_answers').$type<number[]>(),
	points: numeric('points', { precision: 10, scale: 2, mode: 'number' }).notNull(),
	sortOrder: integer('sort_order').notNull(),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	revision: integer('revision').notNull().default(1),
	updatedById: text('updated_by_id'),
	updatedByName: text('updated_by_name')
});
export const examCodes = pgTable('exam_codes', {
	id: uuid('id').defaultRandom().primaryKey(),
	code: text('code').notNull().unique(),
	discordId: text('discord_id').notNull(),
	status: text('status').notNull().default('unused'),
	reusable: boolean('reusable').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	startedAt: timestamp('started_at'),
	completedAt: timestamp('completed_at')
});
export const attempts = pgTable(
	'exam_attempts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		codeId: uuid('code_id')
			.notNull()
			.references(() => examCodes.id),
		discordId: text('discord_id').notNull(),
		username: text('username').notNull(),
		displayName: text('display_name').notNull(),
		avatar: text('avatar'),
		startedAt: timestamp('started_at').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		submittedAt: timestamp('submitted_at'),
		timedOut: boolean('timed_out').notNull().default(false),
		objectiveScore: numeric('objective_score', { precision: 10, scale: 2, mode: 'number' })
			.notNull()
			.default(0),
		subjectiveScore: numeric('subjective_score', { precision: 10, scale: 2, mode: 'number' }),
		totalScore: numeric('total_score', { precision: 10, scale: 2, mode: 'number' })
	},
	(t) => [index('attempt_code_id_idx').on(t.codeId)]
);
export const examQuestions = pgTable('exam_questions', {
	id: uuid('id').defaultRandom().primaryKey(),
	attemptId: uuid('attempt_id')
		.notNull()
		.references(() => attempts.id, { onDelete: 'cascade' }),
	sourceQuestionId: uuid('source_question_id'),
	type: text('type').notNull(),
	content: text('content').notNull(),
	options: jsonb('options').$type<string[]>(),
	correctAnswer: integer('correct_answer'),
	correctAnswers: jsonb('correct_answers').$type<number[]>(),
	points: numeric('points', { precision: 10, scale: 2, mode: 'number' }).notNull(),
	sortOrder: integer('sort_order').notNull()
});
export const answers = pgTable(
	'answers',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		attemptQuestionId: uuid('attempt_question_id')
			.notNull()
			.references(() => examQuestions.id, { onDelete: 'cascade' }),
		value: text('value').notNull().default(''),
		score: numeric('score', { precision: 10, scale: 2, mode: 'number' }),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [uniqueIndex('answer_one_per_question').on(t.attemptQuestionId)]
);
