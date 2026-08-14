# OWKR EXAM 작업 가이드

## 프로젝트 개요

OWKR 관리자 선발을 위한 웹 기반 CBT 시험 시스템입니다. 응시자는 Discord OAuth로 식별되며,
관리자가 문제·응시 코드·채점을 관리합니다. 시험 답안과 시간 제한, 관리자 권한은 모두 서버가
신뢰 기준입니다.

## 기술 스택

- SvelteKit 2 + Svelte 5 runes + TypeScript
- Tailwind CSS 4
- PostgreSQL (Neon) + Drizzle ORM
- Discord OAuth 2.0, 자체 서명 세션 쿠키
- Zod 계약 검증, Boundra 도메인 경계, TanStack Svelte Query
- Vercel 배포, `pnpm` 패키지 매니저

## 자주 쓰는 명령

```bash
pnpm dev                 # 일반 로컬 개발
pnpm dev:local           # localhost에서만 Discord 로그인 우회
pnpm check               # TypeScript 및 Svelte 검사
pnpm build               # 프로덕션 빌드
pnpm format              # Prettier 적용
pnpm format:check        # 포맷 검사
pnpm check:naming        # kebab-case 파일명 검사
pnpm check:boundaries    # Boundra 도메인 경계 검사
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

변경 범위에 따라 최소 `pnpm check`, `pnpm build`, `pnpm format:check`를 실행합니다. 도메인
경계나 파일을 건드렸다면 `pnpm check:boundaries`, 새 파일·디렉터리를 만들었다면
`pnpm check:naming`도 실행합니다.

## 디렉터리와 책임

- `src/routes`: 화면과 HTTP 진입점. 비즈니스 규칙을 직접 중복 구현하지 않습니다.
- `src/lib/domains/exam`: 시험 도메인 계약과 클라이언트·서버 공개 API.
  - 라우트는 `client/public.ts`, `server/public.ts`, `shared/public.ts`만 통해 접근합니다.
- `src/lib/server`: 인증, DB, 스키마, 시험 종료·채점처럼 서버 전용 로직.
- `src/lib/admin`: 관리자 화면 전용 표시 형식과 작은 UI 보조 로직.
- `src/lib/components`: 재사용 Svelte 컴포넌트. 파일명은 kebab-case입니다.
- `drizzle`: 생성된 마이그레이션. 스키마 변경 시에만 새 마이그레이션을 추가합니다.
- `static`: 파비콘 등 브라우저가 직접 제공받는 정적 자산.

파일·디렉터리 이름은 kebab-case, 변수와 함수는 camelCase, 타입과 컴포넌트 식별자는 PascalCase를
사용합니다. SvelteKit 예약 파일과 Drizzle 생성 파일은 예외입니다.

## 인증과 권한

- 관리자 여부는 `ADMIN_DISCORD_IDS`와 로그인된 Discord User ID의 서버 측 비교로만 판단합니다.
- 관리자 화면, form action, `/api/admin/*`는 모두 서버에서 `admin(...)` 검증을 거쳐야 합니다.
- `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `DATABASE_URL`, `ADMIN_DISCORD_IDS`를 클라이언트
  코드·응답·로그에 노출하지 않습니다.
- OAuth `state` 검증과 안전한 HttpOnly 세션 쿠키 흐름을 우회하지 않습니다.
- `OWKR_LOCAL_AUTH_BYPASS=true`는 localhost 개발 전용입니다. 운영 동작이나 배포 설정에 의존하지
  않습니다.

## 시험 무결성 규칙

- 시간 종료 판정은 항상 서버의 `expiresAt` 기준입니다. 클라이언트 타이머는 표시용입니다.
- 답안 저장과 제출 시도마다 attempt 소유자, 제출 여부, 만료 여부를 서버에서 확인합니다.
- 제출된 답안은 변경할 수 없어야 하며, 제출은 idempotent해야 합니다.
- 객관식 `correctAnswer`는 응시 중인 클라이언트 payload, HTML, 로그에 포함하지 않습니다.
- 시험 시작은 코드 상태 변경과 attempt·문제 snapshot 생성을 트랜잭션으로 처리합니다.
- 이미 시작한 시험은 `exam_questions` snapshot을 사용합니다. 문제은행을 수정해도 진행·완료 attempt의
  문제, 정답, 배점, 순서에 영향을 주면 안 됩니다.
- 다른 Discord 계정, 다른 attempt, 만료된 코드에 대한 접근을 허용하지 않습니다.
- 시험 및 민감한 응답의 `Cache-Control: no-store, private` 정책을 약화하지 않습니다.

## 데이터베이스 작업

- 스키마 원본은 `src/lib/server/schema.ts`입니다.
- 스키마를 변경하면 `pnpm drizzle-kit generate`으로 마이그레이션을 생성하고, 로컬 DB에 적용하기 전
  생성 SQL을 검토합니다.
- 기존 attempt snapshot 또는 answers 데이터를 의미 없이 재작성·삭제하지 않습니다.
- 운영 DB 마이그레이션은 `DATABASE_URL`이 올바르게 설정된 환경에서만 실행합니다.

## UI 원칙

- 전체 문구는 한국어로 작성합니다.
- 응시 화면은 담백한 한국형 CBT: 시험명, 남은 시간, 문항 상태, 문제, 이전·다음·제출을 우선합니다.
- 시험 내부의 문제 이동에는 URL이나 browser history entry를 추가하지 않습니다. 브라우저 뒤로가기는
  코드 입력 화면으로 복귀시키는 기존 보호 흐름을 유지합니다.
- 관리자는 예쁜 카드보다 빠른 표·목록·상세 작업 흐름을 우선합니다. 데스크톱은 좌측 메뉴와 우측
  작업 영역을 유지하고, 모든 섹션은 같은 위치의 Breadcrumb으로 현재 계층과 목록 복귀 경로를
  표시합니다. 상세 화면에서는 이전 목록을 함께 노출하지 않습니다.
- 공통 버튼은 `btn`, `btn-secondary`, 표는 `table-head`, 상태 표시는 `badge`를 우선 재사용합니다.
- 주요 행동에만 OWKR 블루(`#087ba8`)를 사용하고, 불필요한 애니메이션·장식·과도한 카드 중첩을 피합니다.
- 모든 폼 요소는 label 또는 접근 가능한 이름을 가져야 하며, 오류는 일관된 한국어 메시지로 안내합니다.

## 성능과 네비게이션

- 관리자 탭은 신뢰성 있는 전체 페이지 전환(`data-sveltekit-reload`)을 사용합니다. URL만 바뀌고
  화면이 갱신되지 않는 클라이언트 전환을 다시 도입하지 않습니다.
- 문제 상세는 목록의 현재 데이터로 즉시 열고, 갱신 요청에도 선택한 문제 ID를 보존합니다.
- 새로운 reactive `$effect`는 자신이 읽는 상태를 다시 쓰지 않도록 검토합니다. 상태 동기화 루프는
  `effect_update_depth_exceeded`와 관리자 화면 멈춤을 유발할 수 있습니다.
- 서버 요청을 추가할 때는 필요한 탭·행만 요청하고, 캐시가 시험 보안 또는 최신 채점 데이터에 영향을
  주지 않는지 확인합니다.

## Git과 환경 변수

- `.env`, `.env.*`, `.idea`, `.vscode`, 빌드 산출물은 커밋하지 않습니다. `.env.example`만 갱신합니다.
- 사용자가 명시적으로 요청하기 전에는 커밋만 하고 푸시하지 않습니다.
- 커밋에는 관련 변경만 포함하며, 기존 사용자의 미관련 변경을 되돌리거나 섞지 않습니다.
- 배포 전 필요한 환경 변수는 `.env.example`과 Vercel 환경 변수 설정의 일관성을 확인합니다.
