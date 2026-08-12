import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { confirmModal, esc, fmtDateTime, initAdminPage } from '../layout';

/** §1-2 학번 화이트리스트 — 일괄 등록·삭제(=강등). 승격의 유일한 수단. */
async function main(): Promise<void> {
  const ctx = await initAdminPage('whitelist');
  if (!ctx) return;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>학번 화이트리스트</h1>
      <span class="hint">등록 = 즉시(또는 가입 시) MEMBER 승격 · 삭제 = GUEST 강등</span></div>
    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 일괄 등록 (한 줄에 학번 하나)</div>
        <form class="mform" id="wlForm">
          <textarea class="mctl" id="wlIds" placeholder="202517030&#10;202517031&#10;202517032" style="min-height:150px;font-family:var(--mono)" required></textarea>
          <div class="mgrid2">
            <div><label for="wlGen">기수 (선택)</label><input class="mctl" id="wlGen" inputmode="numeric" placeholder="15" /></div>
            <div><label for="wlNote">메모 (선택)</label><input class="mctl" id="wlNote" placeholder="15기 신입" maxlength="200" /></div>
          </div>
          <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">등록</button></div>
        </form>
        <p class="mtop__desc" style="margin-top:12px">이미 가입한 학번은 즉시 승격되고, 미가입 학번은 가입하는 순간 회원으로 시작합니다.</p>
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 등록된 학번 <span id="wlCount" style="color:var(--dim)"></span></div>
        <div style="overflow-x:auto">
          <table class="mtable">
            <thead><tr><th>학번</th><th>기수</th><th>가입</th><th>메모</th><th>등록</th><th></th></tr></thead>
            <tbody id="wlBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  async function load(): Promise<void> {
    const body = document.getElementById('wlBody')!;
    try {
      const rows = await api.admin.whitelist.list();
      document.getElementById('wlCount')!.textContent = `· ${rows.length}건`;
      body.innerHTML = rows.length
        ? rows
            .map(
              (w) => `
          <tr>
            <td class="mono"><b>${esc(w.studentId)}</b></td>
            <td>${w.generation ? `${w.generation}기` : '-'}</td>
            <td>${w.joined ? '<span class="mtag">가입됨</span>' : '<span class="dim">미가입</span>'}</td>
            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis">${w.note ? esc(w.note) : '-'}</td>
            <td class="mono" style="font-size:11.5px">${fmtDateTime(w.addedAt)}<br /><span class="dim">by ${esc(w.addedBy)}</span></td>
            <td><button class="mbtn mbtn--danger" data-del="${esc(w.studentId)}" data-joined="${w.joined}" style="padding:3px 10px;font-size:11.5px">삭제</button></td>
          </tr>`,
            )
            .join('')
        : '<tr><td colspan="6" style="text-align:center;color:var(--dim)">등록된 학번이 없습니다</td></tr>';

      body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          void (async () => {
            const sid = b.dataset.del!;
            // 삭제 = 강등 — 반드시 확인 모달 (§1-2)
            const c = await confirmModal({
              title: '화이트리스트에서 삭제',
              message:
                b.dataset.joined === 'true'
                  ? `${sid} 를 명단에서 지우면 이 학번의 계정은 즉시 GUEST로 강등됩니다. 계속할까요?`
                  : `${sid} 를 명단에서 지울까요? (아직 가입 전인 학번입니다)`,
              confirmLabel: '삭제·강등',
              danger: true,
              withReason: true,
            });
            if (!c.ok) return;
            const r = await api.admin.whitelist.remove(sid, c.reason);
            toast(r.demoted ? '삭제했고 계정을 GUEST로 강등했습니다.' : '명단에서 삭제했습니다.');
            void load();
          })();
        }),
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.');
    }
  }

  document.getElementById('wlForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const ids = (document.getElementById('wlIds') as HTMLTextAreaElement).value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const genRaw = (document.getElementById('wlGen') as HTMLInputElement).value.trim();
    const note = (document.getElementById('wlNote') as HTMLInputElement).value.trim();
    void api.admin.whitelist
      .add(ids, genRaw ? Number(genRaw) : undefined, note || undefined)
      .then((r) => {
        toast(
          `등록 ${r.added}건 · 즉시 승격 ${r.promoted}건${r.invalid.length ? ` · 무시된 잘못된 학번 ${r.invalid.length}건` : ''}`,
        );
        (document.getElementById('wlIds') as HTMLTextAreaElement).value = r.invalid.join('\n');
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'),
      );
  });

  await load();
}

void main();
