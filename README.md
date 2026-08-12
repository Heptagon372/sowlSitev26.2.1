# SLEEPY OWL (S.OWL) — 동아리 웹사이트

성공회대학교 IT 동아리 **SLEEPY OWL**의 공식 웹사이트.
TypeScript 풀스택 모노레포 — Vite 멀티페이지 프론트 + NestJS API + PostgreSQL 16.
설계도 ①(모집 사이트) + ②(회원 시스템)이 반영되어 있다:
소개 랜딩 홈, 신입 지원서 접수, **비회원/회원/관리자 3등급 회원 시스템**,
회원 전용 공간(30페이지), 관리자 콘솔(회원·화이트리스트·로그·서버랙·설정·DB).

## 구조

```
apps/
  web/   Vite MPA — 프레임워크 없음, 순수 CSS
         ├ 공개: index(랜딩) · apply(지원서) · about · activities · faq
         │        signup · login · gate(회원 전용 안내)
         ├ member/  회원 전용 30페이지 — 카테고리별 폴더
         │    notice/  공지 3   study/    학습 6   project/ 프로젝트 6
         │    community/ 커뮤니티 5   record/ 기록 4   people/ 회원 2
         │    ops/     운영 1   tools/    도구 2   (+ index.html 대시보드)
         └ admin/   관리자 8페이지 (대시보드·회원·화이트리스트·지원서·로그·랙·설정·DB)
  api/   NestJS 11 REST API (+ Prisma / PostgreSQL 16 / Argon2id / JWT 쿠키)
packages/
  shared/  프론트·백 공용 타입 + 검증 규칙 (CJS/ESM 듀얼 빌드)
tools/
  launcher.mjs  S.OWL 개발 서버 구동기 (CLI)
```

폴더 슬러그는 URL에 그대로 드러나므로 ASCII를 쓴다 (`/member/study/studies.html`).
한글 폴더명은 퍼센트 인코딩되어 링크가 지저분해지고, 이 저장소는 한글 경로 때문에
이미 도구가 한 번 깨진 적이 있다(아래 '알아둘 것' 참고).

## 로컬 실행

```bash
pnpm install
pnpm dev        # = pnpm sowl — DB(5432) + API(3001) + 웹(5173)을 한 번에
```

Docker 없이도 동작한다 — `apps/api/scripts/local-db.mjs` 가
`@embedded-postgres` 바이너리로 PostgreSQL 16을 `%LOCALAPPDATA%\sowl\pgdata` 에 띄운다.
Docker가 있다면 `docker compose up -d` 를 써도 된다.

최초 1회 (DB가 뜬 상태에서):

```bash
pnpm --filter @sowl/api db:migrate   # prisma migrate dev
pnpm --filter @sowl/api db:seed      # 모집 설정 + 자랑 숫자 시드
```

환경변수는 `apps/api/.env.example` 참고 — **`DB_ACCESS_PASSPHRASE` 와
`JWT_ACCESS_SECRET` 이 비어 있으면 서버가 부팅에 실패한다** (설계도 ② §8, 의도된 동작).

## 등급 체계 (설계도 ② §1)

| 등급 | 얻는 방법 | 권한 |
|---|---|---|
| `GUEST` | 회원가입 (누구나) — **가입 직후는 무조건 GUEST** | 공개 페이지 + 지원서 |
| `MEMBER` | **관리자의 학번 화이트리스트 등록**이 유일한 경로 | 회원 전용 공간 (`/member/*`) |
| `ADMIN` | DB 직접 수정 또는 `BOOTSTRAP_ADMIN_STUDENT_ID` 환경변수 | + 관리자 콘솔 (`/admin/*`) |

- 화이트리스트는 **가입 순서와 등록 순서가 어느 쪽이든 같은 결과**: 이미 가입한 학번은 즉시 승격, 미가입 학번은 가입하는 순간 MEMBER로 시작. 명단에서 지우면 GUEST로 강등.
- 지원서 제출은 로그인과 무관하게 누구나 가능. 로그인 상태면 이름·학번·이메일 자동 채움.
- 비회원이 `/member/*` 링크를 누르면 안내 모달, URL 직접 입력은 `/gate.html?from=…` 리다이렉트. 백엔드도 `403 MEMBER_ONLY` 로 이중 차단.

## 인증

- 아이디 = 학번(숫자 9자리 — 입학년도 4자리 + 5자리), 비밀번호는 **8자 이상 + 특수문자 1자 이상** (딱 이 두 조건).
- Argon2id 해시, JWT는 **httpOnly·SameSite=Lax 쿠키** (`localStorage` 금지). access 30분 / refresh 14일(로테이션, DB에는 해시만).
- 로그인 5회 실패 → 15분 잠금(423). 로그인/로그아웃/실패/거부는 전부 `AccessLog`에.
- 위험 작업(DB 콘솔, 지원서 상세·CSV, 로그 내보내기)은 **DB 접근 비밀번호**(`DB_ACCESS_PASSPHRASE`)를 한 번 더 요구 → 15분짜리 elevated 세션. 이 값은 서버 `.env` 에서만 변경 가능하고 웹 UI는 존재하지 않는다. 3회 실패 시 10분 차단, 성공·실패 모두 감사 로그.

## API 요약

| 경로 | 설명 | 권한 |
|---|---|---|
| `GET /api/recruit` · `GET /api/stats` | 모집 정보 · 자랑 숫자 (랙 장비 수 연동) | — |
| `POST /api/applications` | 지원서 제출 (로그인 시 계정 연결) | — |
| `POST /api/auth/signup·login·logout·refresh` / `GET /api/auth/me` | 인증 | — / 쿠키 |
| `GET·… /api/member/**` | 대시보드·공지·일정(iCal)·회원목록·프로필·게시판·자료실 | MEMBER+ |
| `GET·… /api/member/studies·seminars·missions` | 스터디·세미나(출석 코드)·과제(채점) | MEMBER+ (출제·채점은 ADMIN) |
| `GET·… /api/member/projects·team-posts` | 프로젝트 · 팀원 모집/지원 | MEMBER+ |
| `GET·… /api/member/questions·polls` | Q&A(채택) · 설문(투표 집계) | MEMBER+ |
| `GET /api/member/points·activity` | 포인트·랭킹 · 활동 타임라인 | MEMBER+ |
| `GET·… /api/member/events·kanban·hackathons` | 행사 신청 · 칸반 · 해커톤 | MEMBER+ |
| `GET·… /api/member/portfolio·community·chat` | 포트폴리오 · 커뮤니티 허브 · 채팅 | MEMBER+ |
| `GET·… /api/member/dues·certificate` | 회비·운영비 · 활동 확인서 | MEMBER+ (등록은 ADMIN) |
| `GET·… /api/member/github·contests·ai` | GitHub · 공모전 · S.OWL AI | MEMBER+ |
| `WS /api/chat` | 실시간 채팅 (쿠키 인증) | MEMBER+ |
| `GET·PATCH /api/admin/users*` | 계정 목록·등급 변경·잠금·강제 로그아웃 | ADMIN |
| `GET·POST·DELETE /api/admin/whitelist` | 학번 화이트리스트 (일괄 등록) | ADMIN |
| `GET /api/admin/logs/access·audit` (+`/export`) | 접속·감사 로그 (IP는 해시만) | ADMIN (+elevated) |
| `GET·POST·PATCH·DELETE /api/admin/rack` | 서버랙 장비 (42U·헬스체크) | ADMIN |
| `GET·PATCH /api/admin/settings` | 모집 기간·자랑 숫자 | ADMIN |
| `POST /api/admin/db/unlock·query` | DB 접근 비밀번호 · 읽기 전용 쿼리 | ADMIN (+elevated) |

에러 코드 규약: `UNAUTHENTICATED`(401) `MEMBER_ONLY`(403) `ADMIN_ONLY`(403)
`ELEVATION_REQUIRED`(403) `STUDENT_ID_TAKEN`(409) `ACCOUNT_LOCKED`(423) `RECRUIT_CLOSED`(403) 등 — `@sowl/shared` 의 `ERROR_CODES`.

## 회원 전용 공간 (30페이지 — 전부 동작)

**1차 (7)** 대시보드 · 공지사항 · 동아리 일정 · 자료실 · 자유게시판 · 회원 목록 · 내 프로필

**2차 (12)** 스터디(개설·참여·주차) · 스터디 자료실(스터디별 분리) · 세미나(발표자 신청·슬라이드) ·
세미나 출석(6자리 코드 15분 유효) · 과제/미션(제출·채점→포인트) · 프로젝트 ·
팀원 모집(지원·수락 시 팀원 자동 등록) · Q&A(답변 채택) · 설문/투표(단일·복수·익명) ·
포인트/랭킹(기수 필터) · 활동 기록(전체 타임라인) · 내 활동 기록

**3차 (11)** 동아리 행사(참가 신청·정원) · 프로젝트 관리(드래그 칸반·마일스톤) ·
GitHub 연동(공개 활동, 30분 캐시) · 해커톤(회차·팀 편성·제출·심사) · 포트폴리오(공개 갤러리) ·
커뮤니티 허브 · 채팅(WebSocket 실시간, 끊기면 REST 폴백) · 수료 인증(확인번호·인쇄 PDF) ·
회비/운영비(납부 현황·지출 공개) · S.OWL AI · 공모전 확인

설계 판단 몇 가지:

- **포인트**는 세미나 출석·과제 채점에서 자동 적립된다(`PointLog` + `User.points` 동시 갱신, 재채점 시 차액만 정정).
- **활동 타임라인**은 별도 이벤트 테이블 없이 기존 테이블을 모아서 만든다 — 어딘가에서 기록을 빠뜨려 타임라인이 비는 일이 없도록.
- **수료증 PDF**는 서버에서 만들지 않는다. 한글 폰트를 번들해야 해서 무겁고, 브라우저 인쇄(PDF로 저장)로 서식이 그대로 나온다.
- **공모전**은 임의의 사이트를 긁지 않고, 사이트가 공개한 **RSS/Atom 피드**만 읽는다(설계도 ② §15에서 대상·robots.txt가 미확인이므로). 나머지는 관리자 수동 등록.
- **S.OWL AI**는 동아리 자료를 검색해 근거를 모으고, `ANTHROPIC_API_KEY`가 있으면 Claude가 그 근거만 보고 답한다. 키가 없으면 검색 결과만 돌려주고 화면에도 어느 모드인지 표시한다.
- **채팅**은 표준 WebSocket(`/api/chat`)이고, 핸드셰이크의 access 쿠키로 인증해 GUEST·비로그인은 즉시 끊는다 — REST와 같은 규칙을 소켓에도 적용한다.

## 빌드 · 검사

```bash
pnpm build       # shared → api → web
pnpm typecheck   # 전체 워크스페이스 타입 검사
```

## 알아둘 것 (Windows 한국어 환경)

- 프로젝트 경로에 한글(`바탕 화면`)이 있어 postgres 바이너리를 그대로 실행하면
  initdb가 실패한다. `local-db.mjs` 가 ASCII 경로(`%LOCALAPPDATA%\sowl\pg16`)로 미러링해 해결.
- 데이터 디렉터리도 같은 이유로 `%LOCALAPPDATA%\sowl\pgdata` 에 있다.

## 확인·결정이 필요한 항목 (설계도 ② §15)

| 항목 | 현재 상태 |
|---|---|
| Oracle DB 선택 (A안/B안) | **A안(OCI VM + PostgreSQL + Prisma)으로 구현** — 동아리 확인 필요 |
| 최초 관리자 학번 | `.env` `BOOTSTRAP_ADMIN_STUDENT_ID` — 예시값 `202517030`, 실제 학번으로 교체 |
| 비밀번호 재설정(이메일) · 회원 탈퇴 · 강등 시 데이터 처리 | 미구현 (정책 미정) |
| 공모전 수집 대상 | RSS 피드만 지원 — 관리자가 피드 URL을 등록해야 채워진다 |
| S.OWL AI | `ANTHROPIC_API_KEY` 미설정 시 검색 전용으로 동작 (선택) |
| GitHub API 한도 | 비인증 60회/시간 — `GITHUB_TOKEN` 설정 시 5000회 |
| 파일 업로드 제한 | 25MB · 실행 파일 차단 (임시값) |
| Phase 13 (OCI 배포: nginx·HTTPS·백업) | 미착수 — 서버 확보 후 진행 |

## 연락처

GitHub [skhu-Sowl](https://github.com/skhu-Sowl) · 이메일 s.owl.contact@gmail.com · 인스타그램 [@skhu_s.owl](https://www.instagram.com/skhu_s.owl)
