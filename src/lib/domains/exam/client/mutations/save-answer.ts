import type { BoundraCallOptions, BoundraClient } from 'boundra';

import {
	saveAnswerMutation,
	type SaveAnswerMutationInput
} from '../../shared/contracts/save-answer';

export function saveAnswer(
	client: BoundraClient,
	input: SaveAnswerMutationInput,
	options?: BoundraCallOptions
) {
	return client.mutation(saveAnswerMutation, input, options);
}
