import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { admin } from '$lib/server/guard';
import { attemptActions } from './actions/attempt-actions';
import { codeActions } from './actions/code-actions';
import { gradingActions } from './actions/grading-actions';
import { questionActions } from './actions/question-actions';
import type { AdminAction } from './actions/types';
import { adminSections, loadAdminSection, type AdminSection } from './queries/load-admin-section';

export const loadAdminPage = async (event: RequestEvent) => {
	admin(event);
	const section = (event.params as Record<string, string | undefined>).section;
	if (!section) {
		const legacySection = event.url.searchParams.get('tab');
		const target = ['questions', 'codes', 'results'].includes(legacySection || '')
			? legacySection
			: 'overview';
		const attempt = target === 'results' ? event.url.searchParams.get('attempt') : null;
		redirect(307, `/admin/${target}${attempt ? `?attempt=${encodeURIComponent(attempt)}` : ''}`);
	}
	if (!adminSections.includes(section as AdminSection)) {
		error(404, '관리자 메뉴를 찾을 수 없습니다.');
	}
	return loadAdminSection(section as AdminSection, event.url);
};

export const adminActions: Record<string, AdminAction> = {
	...questionActions,
	...attemptActions,
	...gradingActions,
	...codeActions
};
