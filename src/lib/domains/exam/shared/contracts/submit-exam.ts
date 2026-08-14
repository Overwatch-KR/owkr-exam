import { defineMutation, type InferSchema } from 'boundra';
import { z } from 'zod';

export const submitExamInputSchema = z.object({
	attemptId: z.string().uuid(),
	timeout: z.boolean().optional()
});
export const submitExamResultSchema = z.object({
	submittedAt: z.iso.datetime(),
	objectiveScore: z.number().nonnegative(),
	objectiveMaxScore: z.number().nonnegative()
});

export type SubmitExamMutationInput = InferSchema<typeof submitExamInputSchema>;
export type SubmitExamMutationResult = InferSchema<typeof submitExamResultSchema>;

export const submitExamMutation = defineMutation({
	name: 'submit-exam',
	input: submitExamInputSchema,
	result: submitExamResultSchema
});
