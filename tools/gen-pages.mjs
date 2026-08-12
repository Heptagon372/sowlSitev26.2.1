/**
 * 페이지 셸 생성기 —  node tools/gen-pages.mjs
 *
 * 하는 일 두 가지:
 *  A. 회원(/member) · 관리자(/admin) HTML 셸을 통째로 생성한다.
 *     이 파일들은 내용이 없는 껍데기고 실제 화면은 전부 TS가 그린다.
 *     목록은 apps/web/src/member/registry.ts 와 짝을 이루므로 함께 고칠 것.
 *  B. 공개 페이지(index·about·apply…)의 <head>에 크리티컬 CSS와 CSS <link>를 끼워 넣는다.
 *     이쪽은 내용이 손으로 쓴 HTML이라 덮어쓰지 않고 관리 블록만 교체한다.
 *
 * FOUC 방지 구조 (두 겹):
 *  1. 크리티컬 CSS 인라인 — 첫 페인트부터 다크 배경·글꼴이 잡힌다.
 *  2. 진짜 CSS를 <link rel="stylesheet">로 싣는다 — <link>는 렌더 블로킹이라
 *     JS 모듈 그래프(three.js 포함)를 기다리지 않고 스타일이 완성된 채 첫 페인트가 된다.
 *     예전엔 CSS를 엔트리 TS의 import로만 불러서 페이지를 넘길 때마다
 *     맨몸 HTML이 번쩍였다. 그래서 TS에는 CSS import를 두지 않는다 —
 *     페이지별 CSS 목록은 아래 PUBLIC_CSS / MEMBER_CSS / ADMIN_CSS가 관리한다.
 *     (dev는 Vite가 <link> 요청에 CSS를 그대로 서빙 + HMR도 동작,
 *      빌드는 HTML이 rollup 입력이라 <link>가 번들·해시 자산으로 처리된다)
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');

/** 값은 tokens.css / member.css / adminapp.css 와 같아야 한다 (다르면 로드 후 화면이 튄다) */
const CRITICAL = `
  :root{color-scheme:dark}
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;background:#050608;color:#e8eef7;-webkit-font-smoothing:antialiased;
    font-family:'Pretendard Variable',Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif}
  .sk{display:block;border-radius:6px;background:rgba(255,255,255,.07);animation:skp 1.3s ease-in-out infinite}
  @keyframes skp{0%,100%{opacity:.45}50%{opacity:.9}}
  @media (prefers-reduced-motion:reduce){.sk{animation:none}}`;

const CRITICAL_MEMBER = `${CRITICAL}
  .mshell{display:flex;min-height:100svh}
  .msb{width:232px;flex:0 0 232px;height:100svh;padding:18px 14px 24px;
    border-right:1px solid rgba(255,255,255,.1);background:rgba(6,8,11,.85)}
  .mmain{flex:1;min-width:0;display:flex;flex-direction:column}
  .mtop{display:flex;align-items:center;gap:14px;padding:14px 26px;
    border-bottom:1px solid rgba(255,255,255,.1)}
  .mcontent{padding:26px;max-width:1060px;width:100%}
  @media (max-width:900px){.msb{position:fixed;left:0;top:0;transform:translateX(-100%)}.mcontent{padding:18px 16px}}`;

const CRITICAL_ADMIN = `${CRITICAL}
  .anav{display:flex;align-items:center;gap:4px;padding:10px 20px;
    border-bottom:1px solid rgba(255,255,255,.1)}
  .amain{max-width:1180px;margin:0 auto;padding:24px 20px 60px}`;

/**
 * 공개 페이지용 — base.css의 리셋·타이포·배경 레이어와 값이 같아야 한다.
 * (다르면 진짜 CSS가 로드될 때 화면이 튄다)
 */
const CRITICAL_PUBLIC = `
  :root{color-scheme:dark}
  *,*::before,*::after{box-sizing:border-box}
  html{scroll-behavior:smooth;scroll-padding-top:88px;-webkit-text-size-adjust:100%}
  body{margin:0;background:#050608;color:#e8eef7;font-size:16px;line-height:1.6;
    overflow-x:hidden;-webkit-font-smoothing:antialiased;
    font-family:'Pretendard Variable',Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif}
  img{max-width:100%;display:block}
  a{color:inherit;text-decoration:none}
  h1,h2,h3,h4{margin:0;line-height:1.12;letter-spacing:-.03em;font-weight:800}
  p{margin:0}
  ul{margin:0;padding:0;list-style:none}
  .bg-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
  .page{position:relative;z-index:1}
  .wrap{max-width:1180px;margin-inline:auto;padding-inline:22px}`;
// 스크롤 리빌(.rv)은 일부러 넣지 않는다. base.css의 .rv는 opacity:0으로 시작해
// IntersectionObserver가 .in을 붙여야 보이는데, 그 규칙을 여기 인라인하면
// JS가 늦거나 실패했을 때 본문이 통째로 안 보인다. 옵저버가 도착하기 전까지는
// 내용이 그냥 보이는 편이 안전하다.

/** 페이지별 CSS — 각 엔트리 TS가 그리는 화면과 짝 (TS에는 CSS import를 두지 않는다) */
const BASE_CSS = ['tokens.css', 'base.css', 'components.css'];
const PUBLIC_CSS = {
  'index.html': [...BASE_CSS, 'pages/home.css', 'pages/about.css', 'pages/landing.css'], // about.css — .about-grid · .room · .rack 재사용
  'about.html': [...BASE_CSS, 'pages/about.css'],
  'activities.html': [...BASE_CSS, 'pages/activities.css'],
  'apply.html': [...BASE_CSS, 'pages/home.css', 'pages/apply.css'],
  'faq.html': [...BASE_CSS, 'pages/faq.css'],
  'gate.html': [...BASE_CSS, 'pages/auth.css'],
  'login.html': [...BASE_CSS, 'pages/auth.css'],
  'signup.html': [...BASE_CSS, 'pages/auth.css'],
};
const MEMBER_CSS = [...BASE_CSS, 'member.css', 'member-stage2.css', 'member-stage3.css'];
const ADMIN_CSS = [...BASE_CSS, 'member.css', 'adminapp.css']; // member.css — mpanel · mtable · mbtn · mctl 재사용

const cssLinks = (files) =>
  files.map((f) => `<link rel="stylesheet" href="/src/styles/${f}" />`).join('\n');

/** 공개 페이지 — 손으로 쓴 HTML이라 관리 블록(크리티컬 CSS·<link>)만 갈아 끼운다 */
function injectCritical(file) {
  const path = join(WEB, file);
  let html = readFileSync(path, 'utf8');
  const block = `<style data-critical>${CRITICAL_PUBLIC}\n</style>`;

  if (/<style data-critical>[\s\S]*?<\/style>/.test(html)) {
    html = html.replace(/<style data-critical>[\s\S]*?<\/style>/, () => block);
  } else {
    html = html.replace(
      '</head>',
      `<!-- 첫 페인트용 최소 스타일 (tools/gen-pages.mjs가 관리) -->\n${block}\n</head>`,
    );
  }

  const css = PUBLIC_CSS[file];
  if (css) {
    const links = `<!-- gen:css 진짜 CSS — <link>는 렌더 블로킹이라 페이지 전환 FOUC가 없다 (tools/gen-pages.mjs가 관리) -->\n${cssLinks(css)}\n<!-- /gen:css -->`;
    if (/<!-- gen:css[\s\S]*?\/gen:css -->/.test(html)) {
      html = html.replace(/<!-- gen:css[\s\S]*?\/gen:css -->/, () => links);
    } else {
      html = html.replace(block, () => `${block}\n${links}`);
    }
  } else {
    console.warn(`[gen-pages] 경고: ${file} 의 CSS 목록이 PUBLIC_CSS에 없다 — <link> 미주입`);
  }
  writeFileSync(path, html, 'utf8');
}

const MEMBER_SKELETON = `
  <aside class="msb" id="msidebar" aria-busy="true">
    <span class="sk" style="height:30px;width:130px"></span>
    <span class="sk" style="height:10px;width:44px;margin:22px 0 10px"></span>
    <span class="sk" style="height:14px;width:150px;margin-bottom:8px"></span>
    <span class="sk" style="height:14px;width:120px;margin-bottom:8px"></span>
    <span class="sk" style="height:10px;width:44px;margin:22px 0 10px"></span>
    <span class="sk" style="height:14px;width:160px;margin-bottom:8px"></span>
    <span class="sk" style="height:14px;width:135px;margin-bottom:8px"></span>
    <span class="sk" style="height:14px;width:150px"></span>
  </aside>
  <div class="mmain">
    <header class="mtop" id="mtopbar" aria-busy="true">
      <span class="sk" style="height:18px;width:150px"></span>
    </header>
    <main class="mcontent" id="mcontent" aria-busy="true">
      <span class="sk" style="height:88px;width:100%;margin-bottom:18px"></span>
      <span class="sk" style="height:220px;width:100%"></span>
    </main>
  </div>`;

const ADMIN_SKELETON = `
<nav class="anav" id="anav" aria-label="관리자 메뉴" aria-busy="true">
  <span class="sk" style="height:20px;width:110px;margin-right:14px"></span>
  <span class="sk" style="height:16px;width:70px;margin-right:8px"></span>
  <span class="sk" style="height:16px;width:70px;margin-right:8px"></span>
  <span class="sk" style="height:16px;width:90px"></span>
</nav>
<main class="amain" id="amain" aria-busy="true">
  <span class="sk" style="height:26px;width:180px;margin-bottom:20px"></span>
  <span class="sk" style="height:90px;width:100%;margin-bottom:16px"></span>
  <span class="sk" style="height:260px;width:100%"></span>
</main>`;

const head = (title, critical, css) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#050608" />
<link rel="icon" href="/favicon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<!-- 첫 페인트용 최소 스타일 + 진짜 CSS <link> — 페이지 전환 FOUC 방지 -->
<style>${critical}
</style>
${cssLinks(css)}
</head>`;

const memberPage = (id, label, script) => `${head(`${label} | S.OWL Members`, CRITICAL_MEMBER, MEMBER_CSS)}
<body data-page="${id}">

<div class="mshell">${MEMBER_SKELETON}
</div>

<script type="module" src="/src/member/pages/${script}.ts"></script>
</body>
</html>
`;

const adminPage = (id, label) => `${head(`${label} | S.OWL Admin`, CRITICAL_ADMIN, ADMIN_CSS)}
<body>
<!-- 개인정보 화면 — 3D 배경·화려한 연출 없이 정보 밀도 위주 (설계도 ② §9) -->
${ADMIN_SKELETON}
<script type="module" src="/src/admin/pages/${id}.ts"></script>
</body>
</html>
`;

/** [id, 라벨, 폴더, 스크립트(없으면 placeholder)] */
const MEMBER_PAGES = [
  ['index', '대시보드', '', 'dashboard'],
  ['notices', '공지사항', 'notice', 'notices'],
  ['calendar', '동아리 일정', 'notice', 'calendar'],
  ['events', '동아리 행사', 'notice', 'events'],
  ['studies', '스터디', 'study', 'studies'],
  ['study-files', '스터디 자료실', 'study', 'study-files'],
  ['seminars', '세미나', 'study', 'seminars'],
  ['seminar-attendance', '세미나 출석', 'study', 'seminar-attendance'],
  ['missions', '과제 / 미션', 'study', 'missions'],
  ['files', '자료실', 'study', 'files'],
  ['projects', '프로젝트', 'project', 'projects'],
  ['project-manage', '프로젝트 관리', 'project', 'project-manage'],
  ['recruiting', '팀원 모집', 'project', 'recruiting'],
  ['github', 'GitHub 연동', 'project', 'github'],
  ['hackathon', '해커톤', 'project', 'hackathon'],
  ['portfolio', '포트폴리오', 'project', 'portfolio'],
  ['community', '커뮤니티', 'community', 'community'],
  ['board', '자유게시판', 'community', 'board'],
  ['qna', '질문 / Q&A', 'community', 'qna'],
  ['chat', '채팅', 'community', 'chat'],
  ['polls', '설문 / 투표', 'community', 'polls'],
  ['activities', '활동 기록', 'record', 'activities'],
  ['my-activities', '내 활동 기록', 'record', 'my-activities'],
  ['points', '포인트 / 랭킹', 'record', 'points'],
  ['certificate', '수료 / 활동 인증', 'record', 'certificate'],
  ['members', '회원 목록', 'people', 'members'],
  ['profile', '내 프로필', 'people', 'profile'],
  ['dues', '회비 / 운영비', 'ops', 'dues'],
  ['ai', 'S.OWL AI', 'tools', 'ai'],
  ['contests', '공모전 확인', 'tools', 'contests'],
];

const ADMIN_PAGES = [
  ['index', '대시보드'],
  ['members', '회원 관리'],
  ['whitelist', '학번 화이트리스트'],
  ['applications', '지원서 관리'],
  ['logs', '접속·활동 로그'],
  ['rack', '서버랙 관리'],
  ['settings', '사이트 설정'],
  ['db', 'DB 콘솔'],
];

let n = 0;
for (const [id, label, dir, script] of MEMBER_PAGES) {
  const target = dir ? join(WEB, 'member', dir) : join(WEB, 'member');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, `${id}.html`), memberPage(id, label, script ?? 'placeholder'), 'utf8');
  n += 1;
}
for (const [id, label] of ADMIN_PAGES) {
  mkdirSync(join(WEB, 'admin'), { recursive: true });
  writeFileSync(join(WEB, 'admin', `${id}.html`), adminPage(id, label), 'utf8');
  n += 1;
}

// 공개 페이지는 루트의 .html 전부 (내용은 그대로 두고 크리티컬 CSS만 갱신)
const publicPages = readdirSync(WEB).filter((f) => f.endsWith('.html'));
for (const file of publicPages) injectCritical(file);

console.log(
  `[gen-pages] 셸 ${n}개 생성 (member ${MEMBER_PAGES.length} · admin ${ADMIN_PAGES.length}) · ` +
    `공개 페이지 ${publicPages.length}개에 크리티컬 CSS 주입`,
);
