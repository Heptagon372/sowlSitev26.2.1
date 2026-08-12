import type { SessionUser } from '@sowl/shared';
import { SITE } from '../config';
import { api } from '../lib/api';
import { initPageTransitions } from '../lib/transition';
import { initMemberGate } from './memberGate';

interface NavLink {
  href: string;
  label: string;
  match: string[];
}

const LINKS: NavLink[] = [
  { href: '/', label: '홈', match: ['/', '/index.html'] },
  { href: '/about.html', label: '소개', match: ['/about.html'] },
  { href: '/activities.html', label: '활동', match: ['/activities.html'] },
  { href: '/faq.html', label: 'FAQ', match: ['/faq.html'] },
];

function isCurrent(link: NavLink): boolean {
  return link.match.includes(location.pathname);
}

/** §4-3 — 헤더 우측 로그인 상태 표시 */
function authAreaHtml(me: SessionUser | null): string {
  if (!me) {
    return `
      <a class="nav__login" href="/login.html">로그인</a>
      <a class="btn btn--ghost" href="/apply.html"${
        location.pathname === '/apply.html' ? ' aria-current="page"' : ''
      }><span class="live"></span>지원하기</a>`;
  }
  const badge =
    me.role === 'ADMIN'
      ? '<span class="rolebadge rolebadge--admin">관리자</span>'
      : me.role === 'MEMBER'
        ? '<span class="rolebadge rolebadge--member">회원</span>'
        : '<span class="rolebadge rolebadge--guest">비회원</span>';
  const quick =
    me.role === 'ADMIN'
      ? `<a class="nav__quick mono" href="/admin/index.html">관리자 ▸</a>`
      : me.role === 'MEMBER'
        ? `<a class="nav__quick mono" href="/member/index.html">대시보드 ▸</a>`
        : '';
  return `
    ${quick}
    <div class="userchip" id="userChip">
      <button class="userchip__btn" id="userBtn" aria-expanded="false" aria-haspopup="menu">
        <b>${me.name}</b> ${badge}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="userchip__menu" id="userMenu" role="menu">
        <span class="userchip__sid mono">${me.studentId}</span>
        ${me.role !== 'GUEST' ? `<a role="menuitem" href="/member/people/profile.html">내 프로필</a>` : ''}
        ${me.role === 'GUEST' ? `<a role="menuitem" href="/apply.html">지원하기</a>` : ''}
        <button role="menuitem" id="logoutBtn" type="button">로그아웃</button>
      </div>
    </div>`;
}

/** 공통 헤더 주입 — 각 HTML에는 <div id="nav"></div> 만 둔다 */
export function mountNav(): void {
  const host = document.getElementById('nav');
  if (!host) return;

  const linkHtml = () =>
    LINKS.map(
      (l) =>
        `<a class="nav__link" href="${l.href}"${
          isCurrent(l) ? ' aria-current="page"' : ''
        }>${l.label}</a>`,
    ).join('');

  host.innerHTML = `
  <nav class="nav" id="siteNav" aria-label="주 메뉴">
    <a class="brand" href="/" aria-label="S.OWL 홈으로">
      <span class="brand__mark"><img src="/img/soul_logo.png" alt="" width="30" height="30" /></span>
      <span class="brand__txt">
        <span class="brand__name">${SITE.short}</span>
        <span class="brand__sub">${SITE.school} IT 동아리</span>
      </span>
    </a>
    <div class="nav__links">${linkHtml()}</div>
    <div class="nav__right" id="navRight">
      <a class="btn btn--ghost" href="/apply.html"><span class="live"></span>지원하기</a>
      <button class="nav__burger" id="burger" aria-expanded="false" aria-controls="menuOverlay" aria-label="메뉴 열기">
        <i></i><i></i><i></i>
      </button>
    </div>
  </nav>
  <div class="menu-overlay" id="menuOverlay" role="dialog" aria-modal="true" aria-label="메뉴">
    ${LINKS.map(
      (l) =>
        `<a href="${l.href}"${isCurrent(l) ? ' aria-current="page"' : ''}>${l.label}</a>`,
    ).join('')}
    <div class="menu-auth" id="menuAuth"></div>
    <a class="btn btn--ghost menu-cta" href="/apply.html"><span class="live"></span>지원하기</a>
  </div>`;

  const nav = host.querySelector<HTMLElement>('#siteNav')!;
  const burger = host.querySelector<HTMLButtonElement>('#burger')!;
  const overlay = host.querySelector<HTMLElement>('#menuOverlay')!;

  const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setOpen = (open: boolean) => {
    overlay.classList.toggle('on', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () =>
    setOpen(burger.getAttribute('aria-expanded') !== 'true'),
  );
  overlay.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('on')) setOpen(false);
  });

  // 모든 페이지 공통 — 내부 링크 워프 전환 + 입장 연출
  initPageTransitions();

  // 로그인 상태 반영 (실패해도 페이지는 그대로)
  void api.auth
    .me()
    .catch(() => null)
    .then((me) => {
      renderAuth(host, me, burger);
      initMemberGate(me);
    });
}

function renderAuth(host: HTMLElement, me: SessionUser | null, burger: HTMLElement): void {
  const right = host.querySelector<HTMLElement>('#navRight');
  if (right) {
    right.innerHTML = authAreaHtml(me);
    right.appendChild(burger);
  }
  const menuAuth = host.querySelector<HTMLElement>('#menuAuth');
  if (menuAuth) {
    menuAuth.innerHTML = me
      ? `${
          me.role === 'ADMIN'
            ? '<a href="/admin/index.html">관리자 ▸</a>'
            : me.role === 'MEMBER'
              ? '<a href="/member/index.html">대시보드 ▸</a>'
              : ''
        }<button type="button" id="logoutBtnM">로그아웃 (${me.name})</button>`
      : '<a href="/login.html">로그인</a>';
  }

  const doLogout = async () => {
    await api.auth.logout().catch(() => undefined);
    location.href = '/';
  };
  host.querySelector('#logoutBtn')?.addEventListener('click', () => void doLogout());
  host.querySelector('#logoutBtnM')?.addEventListener('click', () => void doLogout());

  const chip = host.querySelector<HTMLElement>('#userChip');
  const btn = host.querySelector<HTMLButtonElement>('#userBtn');
  if (chip && btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = chip.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!chip.contains(e.target as Node)) {
        chip.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}
