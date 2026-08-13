# 코드 컨벤션

## 이름

- 직접 만드는 파일과 디렉터리 이름은 `kebab-case`를 사용합니다.
- Svelte 컴포넌트 파일도 `question-editor.svelte`처럼 작성합니다.
- TypeScript 변수와 함수는 `camelCase`, 타입과 컴포넌트 식별자는 `PascalCase`를 사용합니다.
- 환경변수는 `UPPER_SNAKE_CASE`를 사용합니다.

다음 이름은 프레임워크 또는 도구가 형식을 결정하므로 예외입니다.

- SvelteKit 예약 파일: `+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+error.svelte`
- SvelteKit 동적 라우트: `[section]`
- SvelteKit 앱 파일: `app.d.ts`, `app.html`, `hooks.server.ts`
- Drizzle 생성 마이그레이션과 메타데이터
- 생태계 표준 루트 파일: `README.md`, `LICENSE`

`pnpm check:naming`으로 `src`와 `scripts` 아래의 이름을 검사합니다.

## 코드 정렬

Prettier와 Svelte/Tailwind 플러그인을 사용합니다.

- 정렬: `pnpm format`
- 정렬 확인: `pnpm format:check`
- 타입 및 Svelte 확인: `pnpm check`
