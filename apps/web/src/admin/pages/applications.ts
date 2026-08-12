import { INTEREST_OPTIONS, type AdminApplicationRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { downloadBlob, esc, fmtDateTime, initAdminPage, withElevation } from '../layout';

/**
 * 지원서 관리 — 목록·상세·CSV (①과 동일 기능, 인증만 세션 기반으로 전환)
 * 상세(개인정보 원본)와 내보내기는 §8 elevated 세션이 필요하다.
 */
async function main(): Promise<void> {
  const ctx = await initAdminPage('applications');
  if (!ctx) return;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>지원서 관리</h1><span class="hint" id="genHint"></span>
      <span class="sp"></span>
      <span class="elev off" id="elevBadge">상세·CSV는 DB 비밀번호 필요</span>
      <button class="mbtn" id="csvBtn" type="button">CSV 내보내기</button></div>

    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v" id="sumTotal">0</div><div class="t">총 지원자</div></div>
      <div class="mstat"><div class="v" id="sumToday">0</div><div class="t">오늘 지원</div></div>
      <div class="mstat" style="overflow:hidden"><div class="t" style="margin-bottom:8px">관심 분야 TOP</div><div id="dist" style="font-size:12px"></div></div>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 지원자
        <span class="sp"></span>
        <input class="mctl" id="q" type="search" placeholder="이름·학번 검색" style="max-width:190px;padding:6px 10px" />
        <select class="mctl" id="interestSel" style="max-width:160px;padding:6px 10px"><option value="">관심 분야: 전체</option></select>
        <button class="mbtn" id="orderBtn" type="button" data-order="desc">제출일 ↓</button>
      </div>
      <div style="overflow-x:auto">
        <table class="mtable">
          <thead><tr><th>이름</th><th>학번</th><th>학과 · 학년</th><th>관심 분야</th><th>경험</th><th>제출일시</th></tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="mpanel" id="appDetail" hidden></div>`;

  let order: 'asc' | 'desc' = 'desc';
  let debounce: number | undefined;

  const sel = document.getElementById('interestSel') as HTMLSelectElement;
  for (const i of INTEREST_OPTIONS) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = i;
    sel.appendChild(o);
  }

  function renderRows(rows: AdminApplicationRow[]): void {
    const tbody = document.getElementById('tbody')!;
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `
        <tr data-id="${r.id}" role="button" tabindex="0" style="cursor:pointer">
          <td><b>${esc(r.name)}</b></td>
          <td class="mono">${esc(r.studentId)}</td>
          <td>${esc(r.department)} · ${esc(r.grade)}</td>
          <td>${r.interests.map((i) => `<span class="mtag">${esc(i)}</span>`).join('')}</td>
          <td>${esc(r.experience)}</td>
          <td class="mono" style="font-size:12px">${fmtDateTime(r.createdAt)}</td>
        </tr>`,
          )
          .join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--dim)">조건에 맞는 지원서가 없습니다</td></tr>';

    tbody.querySelectorAll<HTMLTableRowElement>('tr[data-id]').forEach((tr) =>
      tr.addEventListener('click', () => void openDetail(tr.dataset.id!)),
    );
  }

  async function load(): Promise<void> {
    try {
      const data = await api.admin.applications.list({
        q: (document.getElementById('q') as HTMLInputElement).value.trim() || undefined,
        interest: sel.value || undefined,
        order,
      });
      document.getElementById('sumTotal')!.textContent = String(data.total);
      document.getElementById('sumToday')!.textContent = String(data.today);

      const entries = Object.entries(data.interestDist).sort((a, b) => b[1] - a[1]).slice(0, 4);
      document.getElementById('dist')!.innerHTML = entries
        .map(([name, n]) => `<div style="display:flex;justify-content:space-between"><span>${esc(name)}</span><b class="mono" style="color:var(--cyan-hi)">${n}</b></div>`)
        .join('');

      renderRows(data.items);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.');
    }
  }

  /** 상세 — elevated 필요. 403이면 잠금 해제 모달 후 재시도 */
  async function openDetail(id: string): Promise<void> {
    try {
      const d = await withElevation(() => api.admin.applications.detail(id));
      document.getElementById('elevBadge')!.className = 'elev';
      document.getElementById('elevBadge')!.textContent = '🔓 elevated (15분)';
      const box = document.getElementById('appDetail')!;
      box.hidden = false;
      box.innerHTML = `
        <div class="mpanel__t">// ${esc(d.name)} (${esc(d.studentId)}) <span class="sp"></span>
          <button class="mbtn" id="adClose" style="padding:4px 10px;font-size:11.5px">닫기</button></div>
        <div class="mgrid2" style="gap:8px 22px;font-size:14px">
          <div class="mrow" style="cursor:default"><span class="grow dim">학과 / 학년</span><span>${esc(d.department)} / ${esc(d.grade)}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">연락처</span><span class="mono">${esc(d.phone)}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">이메일</span><span class="mono">${esc(d.email)}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">관심 분야</span><span>${d.interests.map((i) => esc(i)).join(', ')}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">개발 경험</span><span>${esc(d.experience)}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">가능 요일</span><span>${d.availableDays.length ? d.availableDays.map(esc).join(', ') : '-'}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">제출일시</span><span class="mono" style="font-size:12.5px">${fmtDateTime(d.createdAt)}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow dim">동의일시</span><span class="mono" style="font-size:12.5px">${fmtDateTime(d.agreedAt)}</span></div>
        </div>
        <div class="mpanel__t" style="margin-top:16px">// 지원 동기</div>
        <div style="white-space:pre-wrap;color:var(--muted);font-size:14px">${esc(d.motivation)}</div>
        ${
          d.wantToBuild
            ? `<div class="mpanel__t" style="margin-top:16px">// 만들어 보고 싶은 것</div>
               <div style="white-space:pre-wrap;color:var(--muted);font-size:14px">${esc(d.wantToBuild)}</div>`
            : ''
        }`;
      box.querySelector('#adClose')!.addEventListener('click', () => {
        box.hidden = true;
      });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '상세를 불러오지 못했습니다.');
    }
  }

  document.getElementById('csvBtn')!.addEventListener('click', () => {
    void withElevation(() => api.admin.applications.exportCsv())
      .then((blob) => {
        downloadBlob(blob, 'sowl-applications.csv');
        document.getElementById('elevBadge')!.className = 'elev';
        document.getElementById('elevBadge')!.textContent = '🔓 elevated (15분)';
      })
      .catch((e: unknown) =>
        toast(e instanceof ApiError ? e.message : 'CSV 내보내기에 실패했습니다.'),
      );
  });

  document.getElementById('q')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 280);
  });
  sel.addEventListener('change', () => void load());
  const orderBtn = document.getElementById('orderBtn') as HTMLButtonElement;
  orderBtn.addEventListener('click', () => {
    order = order === 'desc' ? 'asc' : 'desc';
    orderBtn.textContent = order === 'desc' ? '제출일 ↓' : '제출일 ↑';
    void load();
  });

  void api
    .recruit()
    .then((info) => {
      document.getElementById('genHint')!.textContent = `${info.generation}기 · ${info.periodText}`;
    })
    .catch(() => undefined);

  await load();
}

void main();
