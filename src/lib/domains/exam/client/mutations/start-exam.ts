import type { BoundraCallOptions, BoundraClient } from 'boundra';

import { startExamMutation, type StartExamMutationInput } from '../../shared/contracts/start-exam';

export function startExam(
	client: BoundraClient,
	input: StartExamMutationInput,
	options?: BoundraCallOptions
) {
	return client.mutation(startExamMutation, input, options);
}
