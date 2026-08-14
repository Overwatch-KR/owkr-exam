import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { startExamMutation } from '$lib/domains/exam/shared/public';
import { examRequestError, startExam } from '$lib/domains/exam/server/public';
import { user } from '$lib/server/guard';

export const POST = async (event) => {
	const currentUser = user(event);
	const requestStartedAt = performance.now();
	try {
		const result = await executeContract(
			implementMutation(startExamMutation, (input) => startExam(input, currentUser)),
			await event.request.json()
		);
		const duration = performance.now() - requestStartedAt;
		console.info('exam_start_completed', { durationMs: Math.round(duration) });
		return json(result, {
			headers: { 'Server-Timing': `exam-start;dur=${duration.toFixed(1)}` }
		});
	} catch (error) {
		const requestError = examRequestError(error, '올바른 6자리 코드를 입력해 주세요.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '시험을 시작하지 못했습니다.' }, { status: 500 });
	}
};
