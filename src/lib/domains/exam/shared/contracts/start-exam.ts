import { defineMutation, type InferSchema } from 'boundra';
import { z } from 'zod';

export const examQuestionSchema = z.object({
	id: z.string().uuid(),
	type: z.enum(['multiple', 'short', 'essay']),
	content: z.string(),
	options: z.array(z.string()),
	points: z.number().int().positive(),
	answer: z.string()
});

export const startExamInputSchema = z.object({
	code: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z0-9]{6}$/)
});
export const startExamResultSchema = z.object({
	id: z.string().uuid(),
	expiresAt: z.iso.datetime(),
	questions: z.array(examQuestionSchema)
});

export type StartExamMutationInput = InferSchema<typeof startExamInputSchema>;
export type StartExamMutationResult = InferSchema<typeof startExamResultSchema>;

export type ExamAttempt = InferSchema<typeof startExamResultSchema>;
export type ExamQuestion = InferSchema<typeof examQuestionSchema>;

export const startExamMutation = defineMutation({
	name: 'start-exam',
	input: startExamInputSchema,
	result: startExamResultSchema
});
