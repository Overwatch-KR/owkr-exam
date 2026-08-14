import {
	BoundraRuntimeError,
	createBoundraClient,
	type BoundraCallOptions,
	type BoundraTransport
} from 'boundra';
import { getExamStatus as runGetExamStatus } from './queries/get-exam-status';
import { saveAnswer as runSaveAnswer } from './mutations/save-answer';
import { startExam as runStartExam } from './mutations/start-exam';
import { submitExam as runSubmitExam } from './mutations/submit-exam';
import type {
	GetExamStatusQueryInput,
	SaveAnswerMutationInput,
	StartExamMutationInput,
	SubmitExamMutationInput
} from '../shared/public';

const endpoints: Record<string, string> = {
	'get-exam-status': '/api/exam/status',
	'start-exam': '/api/exam/start',
	'save-answer': '/api/exam/answer',
	'submit-exam': '/api/exam/submit'
};

class ExamApiError extends Error {}

const transport: BoundraTransport = async (request, options) => {
	const endpoint = endpoints[request.name];
	if (!endpoint) throw new ExamApiError(`연결되지 않은 시험 계약입니다: ${request.name}`);

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(request.input),
		signal: options?.signal
	});
	const payload: unknown = await response.json();
	if (!response.ok) {
		const message =
			typeof payload === 'object' &&
			payload !== null &&
			'message' in payload &&
			typeof payload.message === 'string'
				? payload.message
				: '시험 요청을 처리하지 못했습니다.';
		throw new ExamApiError(message);
	}
	return payload;
};

const client = createBoundraClient(transport);

export const getExamStatus = (input: GetExamStatusQueryInput, options?: BoundraCallOptions) =>
	runGetExamStatus(client, input, options);
export const startExam = (input: StartExamMutationInput, options?: BoundraCallOptions) =>
	runStartExam(client, input, options);
export const saveAnswer = (input: SaveAnswerMutationInput, options?: BoundraCallOptions) =>
	runSaveAnswer(client, input, options);
export const submitExam = (input: SubmitExamMutationInput, options?: BoundraCallOptions) =>
	runSubmitExam(client, input, options);

export function examErrorMessage(error: unknown, fallback: string) {
	if (error instanceof BoundraRuntimeError && error.cause instanceof ExamApiError) {
		return error.cause.message;
	}
	return fallback;
}

export type { ExamAttempt, ExamQuestion } from '../shared/public';
