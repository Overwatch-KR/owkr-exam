# OWKR 관리자 시험 · Exam

OWKR 내전 관리자 시험을 위한 웹입니다. 지원자는 Discord 계정으로 로그인하고
운영진이 발급한 응시 코드로 시험을 시작합니다. 시험 운영진은 문제, 응시 코드, 답안과 채점을 관리합니다.

**[관리자 시험 웹](https://owkr-exam.vercel.app) · [내전 규정](https://overwatch-kr.github.io/owkr-docs/) · [Discord 문의](https://discord.gg/overwatchkr)**

## 응시 안내

1. Discord에서 운영진의 관리자 시험 안내와 응시 코드를 받습니다.
2. 시험 웹에서 안내받은 Discord 계정으로 로그인합니다.
3. 응시 코드를 입력하고 화면의 시험 안내를 확인합니다.
4. 제한 시간 안에 답안을 작성하고 제출합니다.

응시 코드는 지정된 Discord 계정에 연결됩니다. 응시·결과 관련 문의는 운영진에게 전달하고,
공개 Issues에는 응시 코드, 시험 답안이나 개인정보를 올리지 마세요.

## 주요 기능

- Discord OAuth 로그인과 계정별 응시 코드
- 제한 시간, 답안 저장과 시험 제출
- 문제은행과 시험 시작 시점의 문항 보존
- 관리자 전용 문제·응시 코드·응시 내역·채점 관리
- 객관식 정답과 관리자 권한을 서버에서 검증

## 개발 환경

SvelteKit 2, Svelte 5, TypeScript와 Tailwind CSS 4를 사용합니다.
데이터는 PostgreSQL에 저장하며 Drizzle ORM으로 스키마와 마이그레이션을 관리합니다.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`.env`에는 별도로 준비한 개발용 데이터베이스와 Discord OAuth 앱을 설정합니다.

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | 개발용 PostgreSQL 연결 주소 |
| `DISCORD_CLIENT_ID` | Discord OAuth 앱 ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth 앱 비밀키 |
| `DISCORD_REDIRECT_URI` | OAuth 콜백 주소. 로컬 기본값은 `http://localhost:5173/auth/callback` |
| `SESSION_SECRET` | 세션 서명용 충분히 긴 임의의 비밀값 |
| `ADMIN_DISCORD_IDS` | 관리자 Discord ID. 여러 ID는 쉼표로 구분 |
| `OWKR_LOCAL_AUTH_BYPASS` | localhost 개발 전용 인증 우회. 기본값 `false` |

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

| 경로 | 책임 |
| --- | --- |
| `src/routes` | 응시·관리자 화면과 HTTP 진입점 |
| `src/lib/domains/exam` | 시험 시작, 답안과 제출 처리 |
| `src/lib/domains/admin` | 문제·코드·응시·채점 관리 |
| `src/lib/server` | 인증, DB와 스키마 |
| `drizzle` | DB 마이그레이션 |

## 관련 프로젝트

- [OWKR 커뮤니티](https://github.com/Overwatch-KR) · [Discord](https://discord.gg/overwatchkr)
- [OWKR Match](https://github.com/Overwatch-KR/owkr-balance) · 내전 참가 명단과 팀 편성
- [Gather Bot](https://github.com/Overwatch-KR/owkr-gather-bot) · Discord 내전 모집과 티어 수집
- [내전 규정](https://github.com/Overwatch-KR/owkr-docs) · 규정, 참가 안내와 FAQ
- [관리자 시험](https://github.com/Overwatch-KR/owkr-exam) · 내전 관리자 시험 웹
- [내전 워크샵](https://github.com/Overwatch-KR/owkr-scrim-workshop) · 준비 중인 OverPy 소스
