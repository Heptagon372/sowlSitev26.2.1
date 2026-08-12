import { EXPENSE_CATEGORIES } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** #28 회비 / 운영비 — 내 납부 상태 + 운영비 사용 내역 공개 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('dues');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  async function load(): Promise<void> {
    let d;
    try {
      d = await api.member.dues.page();
    } catch (e) {
      content.innerHTML = `<p class="mtop__desc">${
        e instanceof ApiError ? esc(e.message) : '회비 정보를 불러오지 못했습니다.'
      }</p>`;
      return;
    }

    content.innerHTML = `
      <div class="mgrid3" style="margin-bottom:18px">
        <div class="mstat"><div class="v">${won(d.totals.collected)}</div><div class="t">걷힌 회비</div></div>
        <div class="mstat"><div class="v">${won(d.totals.spent)}</div><div class="t">사용한 운영비</div></div>
        <div class="mstat"><div class="v" style="color:${d.totals.balance >= 0 ? 'var(--lime)' : 'var(--danger)'}">${won(d.totals.balance)}</div><div class="t">잔액</div></div>
      </div>

      <div class="mpanel">
        <div class="mpanel__t">// 내 납부 상태
          ${isAdmin ? '<span class="sp"></span><button class="mbtn" id="termAdd" style="padding:4px 12px">＋ 학기 추가</button>' : ''}
        </div>
        ${
          d.terms.length
            ? d.terms
                .map(
                  (t) => `<div class="mrow" style="cursor:default">
                    <span class="${t.myPaidAt ? 'mtag' : 'dim'}" style="${
                      t.myPaidAt ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : 'color:var(--danger)'
                    }">${t.myPaidAt ? '납부 완료' : '미납'}</span>
                    <span class="grow">${esc(t.name)} · ${won(t.amount)}</span>
                    <span class="dim">전체 ${t.paidCount}/${t.memberCount}명 납부</span>
                    <span class="dim">마감 ${fmtDate(t.dueDate)}</span>
                    ${isAdmin ? `<button class="mbtn" data-roster="${t.id}" style="padding:3px 10px;font-size:11px">명단</button>
                      <button class="mbtn mbtn--danger" data-termdel="${t.id}" style="padding:3px 10px;font-size:11px">삭제</button>` : ''}
                  </div>
                  <div class="votersbox" data-rosterlist="${t.id}" hidden></div>`,
                )
                .join('')
            : '<p class="mtop__desc">등록된 회비 학기가 없습니다.</p>'
        }
      </div>

      ${
        isAdmin
          ? `<div class="mpanel">
              <div class="mpanel__t">// 운영비 지출 등록 (관리자)</div>
              <form class="mform" id="expForm" style="flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center">
                <input class="mctl" id="eTitle" placeholder="내용" maxlength="100" required style="flex:1;min-width:160px" />
                <input class="mctl" id="eAmount" type="number" min="0" placeholder="금액" required style="max-width:120px" />
                <select class="mctl" id="eCat" style="max-width:110px">
                  ${EXPENSE_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
                </select>
                <input class="mctl" id="eDate" type="date" required style="max-width:150px" />
                <button class="mbtn mbtn--cy" type="submit">등록</button>
              </form>
            </div>`
          : ''
      }

      <div class="mpanel">
        <div class="mpanel__t">// 운영비 사용 내역 <span style="color:var(--dim)">· 전 부원 공개</span></div>
        <div style="overflow-x:auto">
          <table class="mtable">
            <thead><tr><th>날짜</th><th>내용</th><th>분류</th><th>금액</th><th>학기</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
            <tbody>
              ${
                d.expenses.length
                  ? d.expenses
                      .map(
                        (e) => `<tr>
                        <td class="mono" style="font-size:12px">${fmtDate(e.spentAt)}</td>
                        <td>${esc(e.title)}${e.note ? `<br /><span class="dim" style="font-size:11.5px">${esc(e.note)}</span>` : ''}</td>
                        <td><span class="mtag">${esc(e.category)}</span></td>
                        <td class="mono">${won(e.amount)}</td>
                        <td class="dim">${e.termName ? esc(e.termName) : '-'}</td>
                        ${isAdmin ? `<td><button class="mbtn mbtn--danger" data-expdel="${e.id}" style="padding:2px 9px;font-size:11px">삭제</button></td>` : ''}
                      </tr>`,
                      )
                      .join('')
                  : `<tr><td colspan="${isAdmin ? 6 : 5}" style="text-align:center;color:var(--dim)">사용 내역이 없습니다</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;

    bind(d);
  }

  function bind(d: Awaited<ReturnType<typeof api.member.dues.page>>): void {
    const after = (msg: string) => () => {
      toast(msg);
      void load();
    };
    const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.');

    document.getElementById('termAdd')?.addEventListener('click', () => {
      const name = prompt('학기 이름 (예: 2026-1학기)');
      if (!name?.trim()) return;
      const amount = prompt('회비 금액 (원)');
      if (!amount?.trim()) return;
      const due = prompt('납부 마감일 (YYYY-MM-DD)');
      if (!due?.trim()) return;
      void api.member.dues
        .createTerm({
          name: name.trim(),
          amount: Number(amount),
          dueDate: new Date(due).toISOString(),
        })
        .then(after('학기를 추가하고 회원 명단을 만들었습니다.'))
        .catch(fail);
    });

    document.querySelectorAll<HTMLButtonElement>('[data-termdel]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 학기를 삭제할까요? 납부 기록도 함께 사라집니다.')) return;
        void api.member.dues.removeTerm(b.dataset.termdel!).then(after('삭제했습니다.')).catch(fail);
      }),
    );

    document.querySelectorAll<HTMLButtonElement>('[data-roster]').forEach((b) =>
      b.addEventListener('click', () => {
        const termId = b.dataset.roster!;
        const box = document.querySelector<HTMLElement>(`[data-rosterlist="${termId}"]`)!;
        if (!box.hidden) {
          box.hidden = true;
          return;
        }
        const rows = d.roster.filter((r) => r.termId === termId);
        box.hidden = false;
        box.innerHTML = rows.length
          ? rows
              .map(
                (r) => `<div class="mrow" style="cursor:default">
                  <span class="${r.paidAt ? 'mtag' : 'dim'}" style="${
                    r.paidAt ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : 'color:var(--danger)'
                  }">${r.paidAt ? '납부' : '미납'}</span>
                  <span class="grow">${esc(r.name)}</span>
                  <button class="mbtn" data-paid="${termId}:${r.userId}:${r.paidAt ? '0' : '1'}" style="padding:3px 10px;font-size:11px">
                    ${r.paidAt ? '미납으로' : '납부 처리'}</button></div>`,
              )
              .join('')
          : '<p class="mtop__desc">명단이 없습니다.</p>';

        box.querySelectorAll<HTMLButtonElement>('[data-paid]').forEach((pb) =>
          pb.addEventListener('click', () => {
            const [tid, uid, paid] = pb.dataset.paid!.split(':');
            const term = d.terms.find((t) => t.id === tid);
            void api.member.dues
              .setPaid(tid, uid, paid === '1', term?.amount ?? 0, 'TRANSFER')
              .then(after('납부 상태를 변경했습니다.'))
              .catch(fail);
          }),
        );
      }),
    );

    document.getElementById('expForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
      void api.member.dues
        .addExpense({
          title: val('eTitle').trim(),
          amount: Number(val('eAmount')),
          category: val('eCat'),
          spentAt: new Date(val('eDate')).toISOString(),
        })
        .then(after('지출을 등록했습니다.'))
        .catch(fail);
    });

    document.querySelectorAll<HTMLButtonElement>('[data-expdel]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 지출 내역을 삭제할까요?')) return;
        void api.member.dues.removeExpense(b.dataset.expdel!).then(after('삭제했습니다.')).catch(fail);
      }),
    );
  }

  await load();
}

void main();
