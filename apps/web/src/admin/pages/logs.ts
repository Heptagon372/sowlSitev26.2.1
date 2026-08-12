import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { downloadBlob, esc, fmtDateTime, initAdminPage, withElevation } from '../layout';

const ACCESS_ACTIONS = ['LOGIN_SUCCESS', 'LOGIN_FAIL', 'LOGOUT', 'LOCKED', 'MEMBER_DENIED', 'SIGNUP'];
const AUDIT_ACTIONS = [
  'ROLE_CHANGE',
  'WHITELIST_ADD',
  'WHITELIST_REMOVE',
  'SETTINGS_UPDATE',
  'DB_UNLOCK',
  'DB_UNLOCK_FAIL',
  'EXPORT',
  'USER_LOCK',
  'USER_UNLOCK',
  'FORCE_LOGOUT',
];

/** §9-2 접속·감사 로그 — 추가 전용, IP는 해시만 표시, 내보내기는 elevated */
async function main(): Promise<void> {
  const ctx = await initAdminPage('logs');
  if (!ctx) return;

  let tab: 'access' | 'audit' = location.hash === '#audit' ? 'audit' : 'access';
  let page = 1;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>접속 · 활동 로그</h1>
      <span class="hint">로그는 추가 전용 — 수정·삭제 UI는 없습니다 · IP는 해시(앞 16자)만 저장</span></div>
    <div class="atabs" role="tablist">
      <button role="tab" id="tabAccess">접속 로그</button>
      <button role="tab" id="tabAudit">감사 로그</button>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 필터
        <span class="sp"></span>
        <input class="mctl" id="fFrom" type="date" style="max-width:150px;padding:6px 10px" />
        <input class="mctl" id="fTo" type="date" style="max-width:150px;padding:6px 10px" />
        <select class="mctl" id="fAction" style="max-width:180px;padding:6px 10px"></select>
        <input class="mctl" id="fQ" placeholder="학번 검색" style="max-width:140px;padding:6px 10px" />
        <button class="mbtn" id="exportBtn">CSV 내보내기 (elevated)</button>
      </div>
      <div style="overflow-x:auto">
        <table class="mtable">
          <thead id="logHead"></thead>
          <tbody id="logBody"></tbody>
        </table>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
        <button class="mbtn" id="pgPrev" style="padding:4px 12px">←</button>
        <span class="mtop__desc" id="pgInfo"></span>
        <button class="mbtn" id="pgNext" style="padding:4px 12px">→</button>
      </div>
    </div>`;

  function syncTabs(): void {
    document.getElementById('tabAccess')!.setAttribute('aria-selected', String(tab === 'access'));
    document.getElementById('tabAudit')!.setAttribute('aria-selected', String(tab === 'audit'));
    const actionSel = document.getElementById('fAction') as HTMLSelectElement;
    const actions = tab === 'access' ? ACCESS_ACTIONS : AUDIT_ACTIONS;
    actionSel.innerHTML =
      '<option value="">액션: 전체</option>' +
      actions.map((a) => `<option>${a}</option>`).join('');
    document.getElementById('logHead')!.innerHTML =
      tab === 'access'
        ? '<tr><th>일시</th><th>액션</th><th>계정</th><th>경로</th><th>IP 해시</th></tr>'
        : '<tr><th>일시</th><th>행위자</th><th>액션</th><th>대상</th><th>사유</th><th>IP 해시</th></tr>';
  }

  async function load(): Promise<void> {
    const params: Record<string, string> = { page: String(page) };
    const from = (document.getElementById('fFrom') as HTMLInputElement).value;
    const to = (document.getElementById('fTo') as HTMLInputElement).value;
    const action = (document.getElementById('fAction') as HTMLSelectElement).value;
    const q = (document.getElementById('fQ') as HTMLInputElement).value.trim();
    if (from) params.from = from;
    if (to) params.to = to;
    if (action) params.action = action;
    if (q) params.q = q;

    const body = document.getElementById('logBody')!;
    try {
      if (tab === 'access') {
        const data = await api.admin.logs.access(params);
        body.innerHTML = data.items.length
          ? data.items
              .map(
                (l) => `
            <tr>
              <td class="mono" style="font-size:12px">${fmtDateTime(l.createdAt)}</td>
              <td><span class="mtag">${esc(l.action)}</span></td>
              <td>${esc(l.userName ?? '')} <span class="mono dim" style="font-size:11.5px">${esc(l.studentId ?? '-')}</span></td>
              <td class="mono" style="font-size:11.5px">${esc(l.path ?? '-')}</td>
              <td class="mono" style="font-size:11.5px;color:var(--dim)">${esc(l.ipHash)}</td>
            </tr>`,
              )
              .join('')
          : '<tr><td colspan="5" style="text-align:center;color:var(--dim)">기록이 없습니다</td></tr>';
        document.getElementById('pgInfo')!.textContent = `총 ${data.total}건 · ${page}페이지`;
      } else {
        const data = await api.admin.logs.audit(params);
        body.innerHTML = data.items.length
          ? data.items
              .map(
                (l) => `
            <tr>
              <td class="mono" style="font-size:12px">${fmtDateTime(l.createdAt)}</td>
              <td>${esc(l.actorName)} <span class="mono dim" style="font-size:11.5px">${esc(l.actorStudentId)}</span></td>
              <td><span class="mtag" style="border-color:rgba(244,114,208,.35);color:var(--magenta-hi)">${esc(l.action)}</span></td>
              <td class="mono" style="font-size:11.5px">${esc(l.targetType ?? '')}${l.targetId ? `:${esc(l.targetId)}` : ''}</td>
              <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${l.reason ? esc(l.reason) : '-'}</td>
              <td class="mono" style="font-size:11.5px;color:var(--dim)">${esc(l.ipHash)}</td>
            </tr>`,
              )
              .join('')
          : '<tr><td colspan="6" style="text-align:center;color:var(--dim)">기록이 없습니다</td></tr>';
        document.getElementById('pgInfo')!.textContent = `총 ${data.total}건 · ${page}페이지`;
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '로그를 불러오지 못했습니다.');
    }
  }

  const switchTab = (t: 'access' | 'audit') => {
    tab = t;
    page = 1;
    syncTabs();
    void load();
  };
  document.getElementById('tabAccess')!.addEventListener('click', () => switchTab('access'));
  document.getElementById('tabAudit')!.addEventListener('click', () => switchTab('audit'));

  for (const id of ['fFrom', 'fTo', 'fAction']) {
    document.getElementById(id)!.addEventListener('change', () => {
      page = 1;
      void load();
    });
  }
  let debounce: number | undefined;
  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      page = 1;
      void load();
    }, 300);
  });
  document.getElementById('pgPrev')!.addEventListener('click', () => {
    if (page > 1) {
      page -= 1;
      void load();
    }
  });
  document.getElementById('pgNext')!.addEventListener('click', () => {
    page += 1;
    void load();
  });

  document.getElementById('exportBtn')!.addEventListener('click', () => {
    void withElevation(() => api.admin.logs.exportCsv(tab))
      .then((blob) => downloadBlob(blob, `sowl-${tab}-logs.csv`))
      .catch((e: unknown) =>
        toast(e instanceof ApiError ? e.message : '내보내기에 실패했습니다.'),
      );
  });

  syncTabs();
  await load();
}

void main();
