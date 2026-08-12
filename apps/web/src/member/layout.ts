// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 MEMBER_CSS
import type { SessionUser } from '@sowl/shared';
import { api } from '../lib/api';
import { MEMBER_GROUPS, MEMBER_PAGES, pageById, pagePath, pathOf } from './registry';

export interface MemberContext {
  me: SessionUser;
  content: HTMLElement;
}

/**
 * 회원 공간 공통 부트스트랩 (설계도 ② §5·§6)
 * - 비로그인·GUEST가 URL을 직접 입력해 들어오면 /gate.html?from=<경로> 로 리다이렉트
 * - 사이드바(9그룹·30항목) + 상단바를 그린 뒤 콘텐츠 컨테이너를 돌려준다
 */
export async function initMemberPage(pageId: string): Promise<MemberContext | null> {
  const me = await api.auth.me().catch(() => null);
  if (!me || me.role === 'GUEST') {
    location.replace(`/gate.html?from=${encodeURIComponent(location.pathname)}`);
    return null;
  }

  const page = pageById(pageId);
  document.title = `${page?.label ?? '회원 공간'} | S.OWL Members`;

  const shell = document.querySelector<HTMLElement>('.mshell')!;
  renderSidebar(shell, pageId, me);
  renderTopbar(shell, pageId, me);

  // 스켈레톤을 실제 내용으로 바꾸는 순간 — 짧게 페이드인해서 튀지 않게 한다
  const content = document.getElementById('mcontent')!;
  for (const el of [shell.querySelector('#msidebar'), shell.querySelector('#mtopbar'), content]) {
    el?.removeAttribute('aria-busy');
  }
  content.innerHTML = '';
  content.classList.add('ready');

  return { me, content };
}

function renderSidebar(shell: HTMLElement, pageId: string, me: SessionUser): void {
  const sb = shell.querySelector<HTMLElement>('#msidebar')!;
  const groups = MEMBER_GROUPS.map((g) => {
    const links = MEMBER_PAGES.filter((p) => p.group === g)
      .map(
        (p) => `
        <a class="msb__link${p.implemented ? '' : ' soon'}" href="${pagePath(p)}"${
          p.id === pageId ? ' aria-current="page"' : ''
        }>${p.label}${p.implemented ? '' : '<span class="soonb">SOON</span>'}</a>`,
      )
      .join('');
    return `<div class="msb__group"><div class="msb__gt">${g}</div>${links}</div>`;
  }).join('');

  sb.innerHTML = `
    <a class="msb__brand" href="/">
      <img src="/img/soul_logo.png" alt="" />
      <span><b>S.OWL</b><small>MEMBERS ONLY</small></span>
    </a>
    ${groups}
    ${
      me.role === 'ADMIN'
        ? `<div class="msb__admin"><a href="/admin/index.html">관리자 ▸</a></div>`
        : ''
    }`;
}

function renderTopbar(shell: HTMLElement, pageId: string, me: SessionUser): void {
  const page = pageById(pageId);
  const top = shell.querySelector<HTMLElement>('#mtopbar')!;
  const badge =
    me.role === 'ADMIN'
      ? '<span class="rolebadge rolebadge--admin">관리자</span>'
      : '<span class="rolebadge rolebadge--member">회원</span>';
  top.innerHTML = `
    <button class="msb__toggle" id="msbToggle" aria-label="메뉴 열기">☰</button>
    <div>
      <h1>${page?.label ?? ''}</h1>
      <span class="mtop__desc">${page?.desc ?? ''}</span>
    </div>
    <div class="mtop__spacer"></div>
    <div class="userchip" id="userChip">
      <button class="userchip__btn" id="userBtn" aria-expanded="false" aria-haspopup="menu">
        <b>${me.name}</b> ${badge}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="userchip__menu" role="menu">
        <span class="userchip__sid mono">${me.studentId}${me.generation ? ` · ${me.generation}기` : ''}</span>
        <a role="menuitem" href="${pathOf('profile')}">내 프로필</a>
        <a role="menuitem" href="/">공개 홈으로</a>
        <button role="menuitem" id="logoutBtn" type="button">로그아웃</button>
      </div>
    </div>`;

  top.querySelector('#logoutBtn')?.addEventListener('click', () => {
    void api.auth.logout().finally(() => {
      location.href = '/';
    });
  });

  const chip = top.querySelector<HTMLElement>('#userChip')!;
  const btn = top.querySelector<HTMLButtonElement>('#userBtn')!;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    chip.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!chip.contains(e.target as Node)) chip.classList.remove('open');
  });

  const sb = shell.querySelector<HTMLElement>('#msidebar')!;
  top.querySelector('#msbToggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    sb.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (sb.classList.contains('open') && !sb.contains(e.target as Node)) {
      sb.classList.remove('open');
    }
  });
}

/* ---------- 공용 유틸 ---------- */

export function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${fmtDate(iso)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
