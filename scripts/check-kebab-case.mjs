import { readdir } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'scripts'];
const reservedFiles = new Set([
	'app.d.ts',
	'app.html',
	'hooks.server.ts',
	'+error.svelte',
	'+layout.svelte',
	'+page.svelte',
	'+page.server.ts',
	'+server.ts'
]);
const kebabSegment = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dynamicRoute = /^\[[a-z0-9]+(?:-[a-z0-9]+)*\]$/;
const violations = [];

function validFileName(name) {
	if (reservedFiles.has(name)) return true;
	const segments = name.split('.');
	return segments.every((segment) => kebabSegment.test(segment));
}

async function inspect(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!kebabSegment.test(entry.name) && !dynamicRoute.test(entry.name))
				violations.push(entryPath);
			await inspect(entryPath);
		} else if (!validFileName(entry.name)) {
			violations.push(entryPath);
		}
	}
}

for (const root of roots) await inspect(root);

if (violations.length) {
	console.error(
		'케밥 케이스가 아닌 경로가 있습니다:\n' + violations.map((item) => `- ${item}`).join('\n')
	);
	process.exitCode = 1;
} else {
	console.log('파일 및 디렉터리 이름이 케밥 케이스 규칙을 따릅니다.');
}
