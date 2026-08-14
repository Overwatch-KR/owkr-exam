import { json } from '@sveltejs/kit';
import { executeContract, implementQuery } from 'boundra';
import { getExamStatusQuery } from '$lib/domains/exam/shared/public';
import { examRequestError, getExamStatus } from '$lib/domains/exam/server/public';
import { user } from '$lib/server/guard';

export const POST = async (event) => {
	const currentUser = user(event);
	try {
		const result = await executeContract(
			implementQuery(getExamStatusQuery, (input) => getExamStatus(input, currentUser)),
			await event.request.json()
		);
		return json(result);
	} catch (error) {
		const requestError = examRequestError(error, '시험 상태 정보가 올바르지 않습니다.');
		if (requestError)
			return json({ message: requestError.message }, { status: requestError.status });
		console.error(error);
		return json({ message: '시험 상태를 확인하지 못했습니다.' }, { status: 500 });
	}
};
