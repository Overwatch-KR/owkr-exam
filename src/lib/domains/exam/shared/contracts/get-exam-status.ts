import { defineQuery, type InferSchema } from 'boundra';
import { z } from 'zod';

export const getExamStatusInputSchema = z.object({
	attemptId: z.string().uuid()
});

export const getExamStatusResultSchema = z.object({
	expiresAt: z.iso.datetime(),
	pausedAt: z.iso.datetime().nullable(),
	submittedAt: z.iso.datetime().nullable(),
	timedOut: z.boolean(),
	serverNow: z.iso.datetime()
});

export type GetExamStatusQueryInput = InferSchema<typeof getExamStatusInputSchema>;
export type GetExamStatusQueryResult = InferSchema<typeof getExamStatusResultSchema>;

export const getExamStatusQuery = defineQuery({
	name: 'get-exam-status',
	input: getExamStatusInputSchema,
	result: getExamStatusResultSchema
});
