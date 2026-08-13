import { defineMutation, type InferSchema } from 'boundra';
import { z } from 'zod';

export const saveAnswerInputSchema = z.object({
	attemptQuestionId: z.string().uuid(),
	value: z.string().max(10000)
});
export const saveAnswerResultSchema = z.object({
	ok: z.literal(true)
});

export type SaveAnswerMutationInput = InferSchema<typeof saveAnswerInputSchema>;
export type SaveAnswerMutationResult = InferSchema<typeof saveAnswerResultSchema>;

export const saveAnswerMutation = defineMutation({
	name: 'save-answer',
	input: saveAnswerInputSchema,
	result: saveAnswerResultSchema
});
