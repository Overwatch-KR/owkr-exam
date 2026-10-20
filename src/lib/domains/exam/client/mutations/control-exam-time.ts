import type { BoundraCallOptions, BoundraClient } from 'boundra';
import {
	controlExamTimeMutation,
	type ControlExamTimeMutationInput
} from '../../shared/contracts/control-exam-time';
export function controlExamTime(
	client: BoundraClient,
	input: ControlExamTimeMutationInput,
	options?: BoundraCallOptions
) {
	return client.mutation(controlExamTimeMutation, input, options);
}
