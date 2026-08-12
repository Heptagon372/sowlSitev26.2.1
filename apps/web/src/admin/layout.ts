// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 ADMIN_CSS
import type { SessionUser } from '@sowl/shared';
import { toast } from '../components/toast';
import { ApiError, api } from '../lib/api';

export interface AdminPageDef {
  id: string;
  file: string;
  label: string;
}

export const ADMIN_PAGES: AdminPageDef[] = [
  { id: 'index', file: 'index.html', label: '대시보드' },
  { id: 'members', file: 'members.html', label: '회원 관리' },
  { id: 'whitelist', file: 'whitelist.html', label: '학번 화이트리스트' },
  { id: 'applications', file: 'applications.html', label: '지원서' },
  { id: 'logs', file: 'logs.html', label: '로그' },
  { id: 'rack', file: 'rack.html', label: '서버랙' },
  { id: 'settings', file: 'settings.html', label: '사이트 설정' },
  { id: 'db', file: 'db.html', label: 'DB 콘솔' },
];

export interface AdminContext {
  me: SessionUser;
  content: HTMLElement;
}

/** 관리자 페이지 부트스트랩 — ADMIN이 아니면 로그인으로 보낸다 */
export async function initAdminPage(pageId: string): Promise<AdminContext | null> {
  const me = await api.auth.me().catch(() => null);
  if (!me || me.role !== 'ADMIN') {
    location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
    return null;
  }

  const page = ADMIN_PAGES.find((p) => p.id === pageId);
  document.title = `${page?.label ?? '관리자'} | S.OWL Admin`;

  const nav = document.getElementById('anav')!;
  nav.innerHTML = `
    <a class="anav__brand" href="/admin/index.html">
      <img src="/img/soul_logo.png" alt="" />
      <b>S.OWL</b><span class="rolebadge rolebadge--admin">ADMIN</span>
    </a>
    ${ADMIN_PAGES.map(
      (p) =>
        `<a class="anav__tab" href="/admin/${p.file}"${
          p.id === pageId ? ' aria-current="page"' : ''
        }>${p.label}</a>`,
    ).join('')}
    <span class="anav__spacer"></span>
    <span class="anav__me">
      <span>${me.name} (${me.studentId})</span>
      <a class="anav__tab" href="/member/index.html" style="padding:5px 10px">회원 공간</a>
      <button type="button" id="aLogout">로그아웃</button>
    </span>`;

  nav.querySelector('#aLogout')?.addEventListener('click', () => {
    void api.auth.logout().finally(() => {
      location.href = '/';
    });
  });

  // 스켈레톤 → 실제 내용
  const content = document.getElementById('amain')!;
  nav.removeAttribute('aria-busy');
  content.removeAttribute('aria-busy');
  content.innerHTML = '';
  content.classList.add('ready');

  return { me, content };
}

/* ---------- 공용 모달 ---------- */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** 사유 입력칸 표시 (감사 로그에 기록) */
  withReason?: boolean;
}

/** 확인 모달 — 확정 시 { ok: true, reason } */
export function confirmModal(opts: ConfirmOptions): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'amodal';
    wrap.innerHTML = `
      <div class="amodal__scrim"></div>
      <div class="amodal__card" role="dialog" aria-modal="true">
        <h3>${opts.title}</h3>
        <p>${opts.message}</p>
        ${opts.withReason ? '<input class="mctl" id="amReason" placeholder="사유 (선택 — 감사 로그에 남습니다)" maxlength="300" />' : ''}
        <div class="amodal__btns">
          <button class="mbtn" id="amCancel" type="button">취소</button>
          <button class="mbtn ${opts.danger ? 'mbtn--danger' : 'mbtn--cy'}" id="amOk" type="button">${opts.confirmLabel ?? '확인'}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = (ok: boolean) => {
      const reason =
        (wrap.querySelector('#amReason') as HTMLInputElement | null)?.value.trim() || undefined;
      wrap.remove();
      resolve({ ok, reason });
    };
    wrap.querySelector('#amCancel')!.addEventListener('click', () => close(false));
    wrap.querySelector('.amodal__scrim')!.addEventListener('click', () => close(false));
    wrap.querySelector('#amOk')!.addEventListener('click', () => close(true));
    (wrap.querySelector('#amReason') as HTMLInputElement | null)?.focus();
  });
}

/** §8 — DB 접근 비밀번호 입력 모달. 성공하면 15분 elevated 세션 쿠키가 실린다. */
export function unlockModal(): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'amodal';
    wrap.innerHTML = `
      <div class="amodal__scrim"></div>
      <div class="amodal__card" role="dialog" aria-modal="true">
        <h3>DB 접근 비밀번호</h3>
        <p>위험 작업입니다. 서버 구동 시 설정된 DB 접근 비밀번호를 입력하세요.
15분간 유효한 세션이 발급되며, 만료되면 다시 입력해야 합니다.</p>
        <input class="mctl" id="amPass" type="password" placeholder="DB_ACCESS_PASSPHRASE" autocomplete="off" />
        <p id="amErr" style="color:var(--danger);margin:10px 0 0;display:none"></p>
        <div class="amodal__btns">
          <button class="mbtn" id="amCancel" type="button">취소</button>
          <button class="mbtn mbtn--cy" id="amOk" type="button">잠금 해제</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const pass = wrap.querySelector('#amPass') as HTMLInputElement;
    const errEl = wrap.querySelector('#amErr') as HTMLElement;
    const close = (ok: boolean) => {
      wrap.remove();
      resolve(ok);
    };
    const submit = async () => {
      try {
        await api.admin.db.unlock(pass.value);
        toast('15분간 잠금이 해제되었습니다.');
        close(true);
      } catch (e) {
        errEl.textContent = e instanceof ApiError ? e.message : '확인에 실패했습니다.';
        errEl.style.display = 'block';
        pass.select();
      }
    };
    wrap.querySelector('#amCancel')!.addEventListener('click', () => close(false));
    wrap.querySelector('.amodal__scrim')!.addEventListener('click', () => close(false));
    wrap.querySelector('#amOk')!.addEventListener('click', () => void submit());
    pass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void submit();
    });
    pass.focus();
  });
}

/**
 * elevated 세션이 필요한 작업 래퍼 —
 * 403 ELEVATION_REQUIRED가 나오면 잠금 해제 모달을 띄우고 한 번 재시도한다.
 */
export async function withElevation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'ELEVATION_REQUIRED') {
      const ok = await unlockModal();
      if (ok) return fn();
    }
    throw e;
  }
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
