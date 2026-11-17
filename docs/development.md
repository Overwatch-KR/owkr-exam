# OWKR 관리자 시험 개발 안내

## 개발 환경

SvelteKit 2, Svelte 5, TypeScript와 Tailwind CSS 4를 사용합니다.
데이터는 PostgreSQL에 저장하며 Drizzle ORM으로 스키마와 마이그레이션을 관리합니다.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`.env`에는 별도로 준비한 개발용 데이터베이스와 Discord OAuth 앱을 설정합니다.

| 변수                     | 용도                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `DATABASE_URL`           | 개발용 PostgreSQL 연결 주소                                          |
| `DISCORD_CLIENT_ID`      | Discord OAuth 앱 ID                                                  |
| `DISCORD_CLIENT_SECRET`  | Discord OAuth 앱 비밀키                                              |
| `DISCORD_REDIRECT_URI`   | OAuth 콜백 주소. 로컬 기본값은 `http://localhost:5173/auth/callback` |
| `SESSION_SECRET`         | 세션 서명용 충분히 긴 임의의 비밀값                                  |
| `ADMIN_DISCORD_IDS`      | 관리자 Discord ID. 여러 ID는 쉼표로 구분                             |
| `OWKR_LOCAL_AUTH_BYPASS` | localhost 개발 전용 인증 우회. 기본값 `false`                        |

Discord 로그인 없이 로컬 화면을 확인하려면 `pnpm dev:local`을 사용합니다.
인증 우회는 localhost 개발 전용이며, 데이터베이스 연결을 대체하지 않습니다. 개발에는 운영 DB를 사용하지 마세요.
환경 변수와 실제 응시 데이터는 Git에 커밋하지 않습니다.

## 데이터베이스

스키마 원본은 `src/lib/server/schema.ts`, 마이그레이션은 `drizzle/`에 있습니다.
개발용 `DATABASE_URL`을 확인한 뒤 필요한 마이그레이션을 적용합니다.

```sh
pnpm drizzle-kit migrate
```

스키마를 변경할 때만 `pnpm drizzle-kit generate`로 새 마이그레이션을 생성하고 SQL을 검토합니다.

## 검증과 빌드

```sh
pnpm check
pnpm build
pnpm format:check
pnpm check:naming
pnpm check:boundaries
```

배포는 Vercel을 기준으로 합니다. 배포 환경의 OAuth 콜백 주소와 환경 변수를 별도로 설정해야 합니다.

## 프로젝트 구조

| 경로                    | 책임                           |
| ----------------------- | ------------------------------ |
| `src/routes`            | 응시·관리자 화면과 HTTP 진입점 |
| `src/lib/domains/exam`  | 시험 시작, 답안과 제출 처리    |
| `src/lib/domains/admin` | 문제·코드·응시·채점 관리       |
| `src/lib/server`        | 인증, DB와 스키마              |
| `drizzle`               | DB 마이그레이션                |
