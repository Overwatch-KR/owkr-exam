import { json } from '@sveltejs/kit';
import { executeContract, implementMutation } from 'boundra';
import { saveAnswerMutation } from '$lib/domains/exam/shared/public';
import { examRequestError, saveAnswer } from '$lib/domains/exam/server/public';
import { user } from '$lib/server/guard';

export const POST = async (event) => {
	const currentUser = user(event);
	try {
		const result = await executeContract(
			implementMutation(saveAnswerMutation, (input) => saveAnswer(input, currentUser)),
			await event.request.json()
		);
		return json(result);
	} catch (error) {
		const requestError = examRequestError(error, '입력이 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '답안을 저장하지 못했습니다.' }, { status: 500 });
	}
};
