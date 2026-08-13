export function questionTypeLabel(type: string) {
	return type === 'multiple' ? '객관식' : type === 'short' ? '단답형' : '서술·논술형';
}

export function codeStatusLabel(status: string, reusable = false) {
	if (reusable) return '테스트 · 반복 사용';
	return (
		{ unused: '미사용', in_progress: '응시 중', completed: '응시 완료', expired: '만료됨' }[
			status
		] ?? status
	);
}
