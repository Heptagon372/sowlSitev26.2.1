/**
 * 페이지 전환 연출 — 평범한 <a href> 내비게이션을 유지한 채(라우터 없음)
 * 내부 링크 클릭 시 터미널 워프 오버레이(`$ cd ~/sowl/...`)를 잠깐 보여주고 이동한다.
 * - target="_blank" · 외부 링크 · 앵커 · 수정키 클릭은 건드리지 않는다
 * - prefers-reduced-motion 이면 연출 없이 즉시 이동
 */

const SLUGS: Record<string, string> = {
  '/': 'home',
  '/index.html': 'home',
  '/apply.html': 'apply',
  '/about.html': 'about',
  '/activities.html': 'activities',
  '/faq.html': 'faq',
  '/signup.html': 'signup',
  '/login.html': 'login',
  '/gate.html': 'members',
};

/** 워프 오버레이에 타이핑할 경로 — /member/study/studies.html → members/studies */
function slugFor(pathname: string): string {
  const known = SLUGS[pathname];
  if (known) return known;
  const member = /^\/member\/(?:[a-z-]+\/)?([a-z-]+)\.html$/.exec(pathname);
  if (member) return `members/${member[1]}`;
  const admin = /^\/admin\/([a-z-]+)\.html$/.exec(pathname);
  if (admin) return `admin/${admin[1]}`;
  return pathname.replace(/^\//, '').replace(/\.html$/, '');
}

const WARP_MS = 520;

export function initPageTransitions(): void {
  // 입장 연출 (CSS: .pt-in)
  document.documentElement.classList.add('pt-in');

  // 뒤로가기(bfcache) 복원 시 남아 있는 오버레이 제거
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) document.getElementById('warp')?.remove();
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a');
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    // 같은 페이지 안의 앵커 이동은 기본 스크롤에 맡긴다
    if (url.pathname === location.pathname && url.hash) return;

    e.preventDefault();
    warpTo(url);
  });
}

function warpTo(url: URL): void {
  if (document.getElementById('warp')) return;
  const slug = slugFor(url.pathname);

  const warp = document.createElement('div');
  warp.id = 'warp';
  warp.className = 'warp';
  warp.setAttribute('aria-hidden', 'true');

  const beam = document.createElement('div');
  beam.className = 'warp__beam';

  const cmd = document.createElement('div');
  cmd.className = 'warp__cmd mono';
  const prompt = document.createElement('span');
  prompt.className = 'warp__prompt';
  prompt.textContent = '$ cd ';
  const path = document.createElement('span');
  path.className = 'warp__path';
  path.textContent = '~/sowl/';
  const typed = document.createElement('span');
  typed.className = 'warp__typed';
  const caret = document.createElement('span');
  caret.className = 'warp__caret';
  cmd.append(prompt, path, typed, caret);

  warp.append(beam, cmd);
  document.body.appendChild(warp);

  // rAF는 탭이 백그라운드면 멈추므로 setTimeout으로도 보장한다
  requestAnimationFrame(() => requestAnimationFrame(() => warp.classList.add('on')));
  window.setTimeout(() => warp.classList.add('on'), 30);

  // 목적지 경로 타이핑
  let i = 0;
  const type = () => {
    typed.textContent = slug.slice(0, ++i);
    if (i < slug.length) window.setTimeout(type, 24);
  };
  window.setTimeout(type, 100);

  window.setTimeout(() => {
    location.href = url.href;
  }, WARP_MS);
}
