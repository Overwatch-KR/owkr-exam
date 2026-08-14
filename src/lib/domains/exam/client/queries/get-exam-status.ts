import type { BoundraCallOptions, BoundraClient } from 'boundra';

import {
	getExamStatusQuery,
	type GetExamStatusQueryInput
} from '../../shared/contracts/get-exam-status';

export function getExamStatus(
	client: BoundraClient,
	input: GetExamStatusQueryInput,
	options?: BoundraCallOptions
) {
	return client.query(getExamStatusQuery, input, options);
}
