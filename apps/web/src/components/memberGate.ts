import type { SessionUser } from '@sowl/shared';
import { api } from '../lib/api';

/**
 * §6 — 비회원(비로그인·GUEST)이 /member/* 링크를 누르면
 * 페이지 이동 없이 안내 모달을 띄운다. 모든 진입 경로에서 동일하게 동작:
 * 사이드바·홈 미리보기·헤더 드롭다운 등 문서 안의 모든 <a>를 가로챈다.
 * (URL 직접 입력은 각 member 페이지가 /gate.html로 리다이렉트한다)
 */

let modal: HTMLElement | null = null;

export function showMemberGateModal(me: SessionUser | null): void {
  if (modal) {
    modal.classList.add('on');
    return;
  }
  modal = document.createElement('div');
  modal.className = 'mgate on';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '회원 전용 공간 안내');
  modal.innerHTML = `
    <div class="mgate__scrim" data-close></div>
    <div class="term mgate__card">
      <div class="term__bar">
        <span class="term__dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="term__path mono">~/sowl/members — access.sh</span>
        <span class="term__tag closed">LOCKED</span>
      </div>
      <div class="term__body mgate__body">
        <img class="mgate__owl" src="/img/soul_logo.png" alt="" width="64" height="64" />
        <h3>S.OWL에 회원으로 오세요!</h3>
        <p>여기는 S.OWL 부원만 들어올 수 있는 공간입니다.<br />
        스터디 자료, 프로젝트, 세미나 기록이 전부 여기 있어요.</p>
        <p class="mgate__dday mono" id="mgateDday"></p>
        <div class="mgate__btns">
          <a class="btn btn--primary" href="/apply.html">
            <span class="ring" aria-hidden="true"></span>
            <span class="inner"><span class="label">지원하러 가기</span></span>
          </a>
          <button class="btn btn--line" type="button" data-close>둘러보기</button>
        </div>
        <p class="mgate__login" id="mgateLogin"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // 비로그인 상태라면 하단에 작게 로그인 안내
  const login = modal.querySelector<HTMLElement>('#mgateLogin')!;
  if (!me) {
    login.innerHTML = `이미 부원이신가요? <a href="/login.html">로그인</a>`;
  } else {
    login.textContent = `${me.name}님은 아직 비회원입니다. 합격 후 관리자가 학번을 등록하면 열려요.`;
  }

  // 모집 D-day
  void api
    .recruit()
    .then((info) => {
      const el = modal?.querySelector('#mgateDday');
      if (!el) return;
      if (info.phase === 'open') {
        const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
        const d = Math.max(
          0,
          Math.round((midnight(new Date(info.endsAt).getTime()) - midnight(Date.now())) / 86_400_000),
        );
        el.textContent = `${info.generation}기 신입 부원을 모집하고 있습니다. D-${d}`;
      } else if (info.phase === 'before') {
        el.textContent = `${info.generation}기 모집이 곧 시작됩니다.`;
      } else {
        el.textContent = `다음 기수 모집을 기다려 주세요.`;
      }
    })
    .catch(() => undefined);

  modal.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close]')) hide();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
}

function hide(): void {
  modal?.classList.remove('on');
}

/** 문서 전체에서 /member/* 링크 클릭을 가로챈다 (회원·관리자는 통과) */
export function initMemberGate(me: SessionUser | null): void {
  if (me && me.role !== 'GUEST') return;
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('/member/')) return;
      e.preventDefault();
      e.stopPropagation();
      showMemberGateModal(me);
    },
    { capture: true }, // 워프 전환보다 먼저 잡는다
  );
}
