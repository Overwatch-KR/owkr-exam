import { defineMutation, type InferSchema } from 'boundra';
import { z } from 'zod';
import { getExamStatusResultSchema } from './get-exam-status';
export const controlExamTimeInputSchema = z.object({
	attemptId: z.string().uuid(),
	action: z.enum(['pause', 'resume'])
});
export type ControlExamTimeMutationInput = InferSchema<typeof controlExamTimeInputSchema>;
export const controlExamTimeMutation = defineMutation({
	name: 'control-exam-time',
	input: controlExamTimeInputSchema,
	result: getExamStatusResultSchema
});
