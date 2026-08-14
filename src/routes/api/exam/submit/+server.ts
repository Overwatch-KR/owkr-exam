import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { submitExamMutation } from '$lib/domains/exam/shared/public';
import { examRequestError, submitExam } from '$lib/domains/exam/server/public';
import { user } from '$lib/server/guard';

export const POST = async (event) => {
	const currentUser = user(event);
	try {
		const result = await executeContract(
			implementMutation(submitExamMutation, (input) => submitExam(input, currentUser)),
			await event.request.json()
		);
		return json(result);
	} catch (error) {
		const requestError = examRequestError(error, '제출할 시험 정보가 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '시험을 제출하지 못했습니다.' }, { status: 500 });
	}
};
