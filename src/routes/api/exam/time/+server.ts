import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { controlExamTimeMutation } from '$lib/domains/exam/shared/public';
import { controlExamTime, examRequestError } from '$lib/domains/exam/server/public';
import { user } from '$lib/server/guard';
export const POST = async (event) => {
	const currentUser = user(event);
	try {
		return json(
			await executeContract(
				implementMutation(controlExamTimeMutation, (input) => controlExamTime(input, currentUser)),
				await event.request.json()
			)
		);
	} catch (error) {
		const requestError = examRequestError(error, '시험 시간 변경 요청이 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '시험 시간을 변경하지 못했습니다.' }, { status: 500 });
	}
};
