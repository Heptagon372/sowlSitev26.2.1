import { api } from '../../lib/api';
import { esc, fmtDateTime, initAdminPage } from '../layout';

/** 관리자 대시보드 — 가입자·회원 수, 오늘 지원자, 최근 로그, 서버 상태 */
async function main(): Promise<void> {
  const ctx = await initAdminPage('index');
  if (!ctx) return;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>대시보드</h1><span class="hint" id="apiState">API 확인 중…</span></div>
    <div class="mgrid3" style="margin-bottom:14px">
      <div class="mstat"><div class="v" id="stUsers">-</div><div class="t">전체 가입 계정</div></div>
      <div class="mstat"><div class="v" id="stMembers">-</div><div class="t">회원 (MEMBER)</div></div>
      <div class="mstat"><div class="v" id="stGuests">-</div><div class="t">비회원 (GUEST)</div></div>
    </div>
    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v" id="stToday">-</div><div class="t">오늘 지원자</div></div>
      <div class="mstat"><div class="v" id="stApps">-</div><div class="t">누적 지원서</div></div>
      <div class="mstat"><div class="v" id="stRack">-</div><div class="t">랙 장비</div></div>
    </div>
    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 최근 접속 로그 <span class="sp"></span><a class="mbtn" href="/admin/logs.html" style="padding:4px 10px;font-size:11.5px">전체</a></div>
        <div id="recentAccess"></div>
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 최근 관리자 작업 <span class="sp"></span><a class="mbtn" href="/admin/logs.html#audit" style="padding:4px 10px;font-size:11.5px">전체</a></div>
        <div id="recentAudit"></div>
      </div>
    </div>`;

  // 서버 상태
  void fetch(`${location.origin.includes('5173') ? 'http://localhost:3001' : ''}/api/health`)
    .then((r) => {
      const el = document.getElementById('apiState');
      if (el) {
        el.textContent = r.ok ? '● API 정상' : '● API 오류';
        el.style.color = r.ok ? 'var(--lime)' : 'var(--danger)';
      }
    })
    .catch(() => {
      const el = document.getElementById('apiState');
      if (el) {
        el.textContent = '● API 연결 불가';
        el.style.color = 'var(--danger)';
      }
    });

  const d = await api.admin.dashboard();
  const set = (id: string, v: number | string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };
  set('stUsers', d.users);
  set('stMembers', d.members);
  set('stGuests', d.guests);
  set('stToday', d.todayApplications);
  set('stApps', d.totalApplications);
  set('stRack', d.rackDevices);

  document.getElementById('recentAccess')!.innerHTML = d.recentAccess.length
    ? d.recentAccess
        .map(
          (l) => `
      <div class="mrow" style="cursor:default">
        <span class="mtag">${esc(l.action)}</span>
        <span class="grow">${esc(l.userName ?? l.studentId ?? '-')}</span>
        <span class="dim mono">${esc(l.ipHash)}</span>
        <span class="dim">${fmtDateTime(l.createdAt)}</span>
      </div>`,
        )
        .join('')
    : '<p class="mtop__desc">기록이 없습니다.</p>';

  document.getElementById('recentAudit')!.innerHTML = d.recentAudit.length
    ? d.recentAudit
        .map(
          (l) => `
      <div class="mrow" style="cursor:default">
        <span class="mtag" style="border-color:rgba(244,114,208,.35);color:var(--magenta-hi)">${esc(l.action)}</span>
        <span class="grow">${esc(l.actorName)} → ${esc(l.targetId ?? '-')}</span>
        <span class="dim">${fmtDateTime(l.createdAt)}</span>
      </div>`,
        )
        .join('')
    : '<p class="mtop__desc">기록이 없습니다.</p>';
}

void main();
