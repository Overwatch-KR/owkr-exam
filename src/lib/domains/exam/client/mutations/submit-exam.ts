import type { BoundraCallOptions, BoundraClient } from 'boundra';

import {
	submitExamMutation,
	type SubmitExamMutationInput
} from '../../shared/contracts/submit-exam';

export function submitExam(
	client: BoundraClient,
	input: SubmitExamMutationInput,
	options?: BoundraCallOptions
) {
	return client.mutation(submitExamMutation, input, options);
}
