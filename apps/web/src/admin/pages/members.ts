import type { AdminUserRow, Role } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { confirmModal, esc, fmtDateTime, initAdminPage } from '../layout';

/** §9-1 회원 관리 — 등급 변경(확인 모달+사유), 잠금, 강제 로그아웃 */
async function main(): Promise<void> {
  const ctx = await initAdminPage('members');
  if (!ctx) return;
  const { me, content } = ctx;

  content.innerHTML = `
    <div class="ahead"><h1>회원 관리</h1>
      <span class="hint">등급 변경·화이트리스트는 전부 감사 로그에 남습니다</span></div>
    <div class="mpanel">
      <div class="mpanel__t">// 필터
        <span class="sp"></span>
        <input class="mctl" id="fQ" placeholder="이름·학번 검색" style="max-width:190px;padding:6px 10px" />
        <select class="mctl" id="fRole" style="max-width:150px;padding:6px 10px">
          <option value="">등급: 전체</option>
          <option value="GUEST">GUEST</option><option value="MEMBER">MEMBER</option><option value="ADMIN">ADMIN</option>
        </select>
        <select class="mctl" id="fLocked" style="max-width:140px;padding:6px 10px">
          <option value="">잠금: 전체</option>
          <option value="true">잠긴 계정</option><option value="false">정상</option>
        </select>
      </div>
      <div style="overflow-x:auto">
        <table class="mtable">
          <thead><tr>
            <th>이름</th><th>학번</th><th>등급</th><th>기수</th><th>가입일</th><th>최근 로그인</th><th>상태</th><th>작업</th>
          </tr></thead>
          <tbody id="uBody"></tbody>
        </table>
      </div>
    </div>`;

  let debounce: number | undefined;

  function roleBadge(role: Role): string {
    const cls =
      role === 'ADMIN' ? 'rolebadge--admin' : role === 'MEMBER' ? 'rolebadge--member' : 'rolebadge--guest';
    return `<span class="rolebadge ${cls}">${role}</span>`;
  }

  function render(rows: AdminUserRow[]): void {
    const body = document.getElementById('uBody')!;
    body.innerHTML = rows.length
      ? rows
          .map(
            (u) => `
        <tr data-id="${u.id}">
          <td><b>${esc(u.name)}</b>${u.whitelisted ? ' <span class="mtag" title="화이트리스트 등록됨">WL</span>' : ''}</td>
          <td class="mono">${esc(u.studentId)}</td>
          <td>${roleBadge(u.role)}</td>
          <td>${u.generation ? `${u.generation}기` : '-'}</td>
          <td class="mono" style="font-size:12px">${fmtDateTime(u.createdAt)}</td>
          <td class="mono" style="font-size:12px">${u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '-'}</td>
          <td>${u.lockedUntil ? '<span class="mtag" style="border-color:rgba(251,113,133,.4);color:var(--danger)">잠김</span>' : '<span class="dim">정상</span>'}</td>
          <td style="white-space:nowrap">
            <select class="mctl" data-role style="display:inline-block;width:auto;padding:4px 8px;font-size:12px">
              ${(['GUEST', 'MEMBER', 'ADMIN'] as Role[])
                .map((r) => `<option value="${r}"${r === u.role ? ' selected' : ''}>${r}</option>`)
                .join('')}
            </select>
            <button class="mbtn" data-lock style="padding:4px 10px;font-size:11.5px">${u.lockedUntil ? '잠금 해제' : '잠금'}</button>
            <button class="mbtn" data-kick style="padding:4px 10px;font-size:11.5px">강제 로그아웃</button>
          </td>
        </tr>`,
          )
          .join('')
      : '<tr><td colspan="8" style="text-align:center;color:var(--dim)">조건에 맞는 계정이 없습니다</td></tr>';

    body.querySelectorAll<HTMLTableRowElement>('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id!;
      const row = rows.find((r) => r.id === id)!;

      tr.querySelector<HTMLSelectElement>('[data-role]')!.addEventListener('change', (e) => {
        const sel = e.target as HTMLSelectElement;
        const next = sel.value as Role;
        void (async () => {
          // 등급 변경은 반드시 확인 모달 + 사유 (§9-1)
          const c = await confirmModal({
            title: '등급 변경',
            message: `${row.name}(${row.studentId})의 등급을 ${row.role} → ${next} 로 변경할까요?${
              row.id === me.id ? '\n⚠ 본인 계정입니다.' : ''
            }`,
            confirmLabel: '변경',
            withReason: true,
            danger: next === 'GUEST',
          });
          if (!c.ok) {
            sel.value = row.role;
            return;
          }
          try {
            render(await api.admin.users.changeRole(id, next, c.reason));
            toast('등급을 변경했습니다.');
          } catch (err) {
            sel.value = row.role;
            toast(err instanceof ApiError ? err.message : '변경에 실패했습니다.');
          }
        })();
      });

      tr.querySelector('[data-lock]')!.addEventListener('click', () => {
        void (async () => {
          const locking = !row.lockedUntil;
          const c = await confirmModal({
            title: locking ? '계정 잠금' : '잠금 해제',
            message: `${row.name}(${row.studentId}) 계정을 ${locking ? '잠글까요? 로그인할 수 없게 됩니다.' : '잠금 해제할까요?'}`,
            confirmLabel: locking ? '잠금' : '해제',
            withReason: locking,
            danger: locking,
          });
          if (!c.ok) return;
          try {
            await api.admin.users.setLock(id, locking, c.reason);
            toast(locking ? '계정을 잠갔습니다.' : '잠금을 해제했습니다.');
            void load();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : '작업에 실패했습니다.');
          }
        })();
      });

      tr.querySelector('[data-kick]')!.addEventListener('click', () => {
        void (async () => {
          const c = await confirmModal({
            title: '강제 로그아웃',
            message: `${row.name}(${row.studentId})의 모든 세션을 종료할까요?\n남은 access 토큰은 최장 30분 내에 만료됩니다.`,
            confirmLabel: '로그아웃',
            danger: true,
          });
          if (!c.ok) return;
          await api.admin.users.forceLogout(id);
          toast('세션을 모두 폐기했습니다.');
        })();
      });
    });
  }

  async function load(): Promise<void> {
    try {
      render(
        await api.admin.users.list({
          q: (document.getElementById('fQ') as HTMLInputElement).value.trim() || undefined,
          role: (document.getElementById('fRole') as HTMLSelectElement).value as Role | '',
          locked: (document.getElementById('fLocked') as HTMLSelectElement).value as '' | 'true' | 'false',
        }),
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.');
    }
  }

  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 300);
  });
  document.getElementById('fRole')!.addEventListener('change', () => void load());
  document.getElementById('fLocked')!.addEventListener('change', () => void load());

  await load();
}

void main();
