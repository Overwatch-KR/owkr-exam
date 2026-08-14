import { BoundraRuntimeError } from 'boundra';

export class ExamRequestError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'ExamRequestError';
	}
}

export function examRequestError(error: unknown, invalidInputMessage: string) {
	if (!(error instanceof BoundraRuntimeError)) return null;
	if (error.cause instanceof ExamRequestError) return error.cause;
	if (error.phase === 'input') return new ExamRequestError(400, invalidInputMessage);
	return null;
}
