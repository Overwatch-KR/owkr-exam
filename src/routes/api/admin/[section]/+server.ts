import { error, json } from '@sveltejs/kit';
import {
	adminSections,
	loadAdminSection,
	type AdminSection
} from '$lib/domains/admin/server/public';
import { admin } from '$lib/server/guard';

export const GET = async (event) => {
	admin(event);
	const section = event.params.section;
	if (!adminSections.includes(section as AdminSection))
		error(404, '관리자 메뉴를 찾을 수 없습니다.');
	return json(await loadAdminSection(section as AdminSection, event.url));
};
