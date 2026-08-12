import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #8 세미나 출석 — 코드 입력 체크 + 개인 출석률 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('seminar-attendance');
  if (!ctx) return;
  const { content } = ctx;

  content.innerHTML = `
    <div class="mpanel checkin">
      <div class="mpanel__t">// 출석 체크</div>
      <p class="mtop__desc" style="margin-bottom:14px">발표자가 화면에 띄운 6자리 코드를 입력하세요. 코드는 15분간만 유효합니다.</p>
      <form id="ciForm" class="checkin__form">
        <input class="mctl codeinput mono" id="ciCode" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="off" required />
        <button class="mbtn mbtn--cy" type="submit" id="ciBtn">출석하기</button>
      </form>
      <p class="checkin__msg" id="ciMsg"></p>
    </div>

    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v" id="stRate">-</div><div class="t">내 출석률</div></div>
      <div class="mstat"><div class="v" id="stAttended">-</div><div class="t">출석한 세미나</div></div>
      <div class="mstat"><div class="v" id="stTotal">-</div><div class="t">지난 세미나</div></div>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 최근 출석 기록</div>
      <div id="ciList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  async function loadStats(): Promise<void> {
    try {
      const s = await api.member.seminars.myStats();
      document.getElementById('stRate')!.textContent = `${s.rate}%`;
      document.getElementById('stAttended')!.textContent = String(s.attended);
      document.getElementById('stTotal')!.textContent = String(s.totalSeminars);
      document.getElementById('ciList')!.innerHTML = s.recent.length
        ? s.recent
            .map(
              (r) => `
          <div class="mrow" style="cursor:default">
            <span class="${r.attended ? 'mtag' : 'dim'}" style="${
              r.attended ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : ''
            }">${r.attended ? '출석' : '결석'}</span>
            <span class="grow">${esc(r.title)}</span>
            <span class="dim">${fmtDate(r.startsAt)}</span>
          </div>`,
            )
            .join('')
        : '<p class="mtop__desc">아직 지난 세미나가 없습니다.</p>';
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '출석 기록을 불러오지 못했습니다.');
    }
  }

  const code = document.getElementById('ciCode') as HTMLInputElement;
  code.addEventListener('input', () => {
    code.value = code.value.replace(/\D/g, '').slice(0, 6);
  });

  document.getElementById('ciForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('ciMsg')!;
    const btn = document.getElementById('ciBtn') as HTMLButtonElement;
    msg.className = 'checkin__msg';
    btn.disabled = true;
    void api.member.seminars
      .checkIn(code.value)
      .then((r) => {
        msg.className = 'checkin__msg ok';
        msg.textContent = `✔ ${r.seminarTitle} 출석 완료 · +${r.points}pt`;
        code.value = '';
        void loadStats();
      })
      .catch((err: unknown) => {
        msg.className = 'checkin__msg bad';
        msg.textContent = err instanceof ApiError ? err.message : '출석에 실패했습니다.';
      })
      .finally(() => {
        btn.disabled = false;
      });
  });

  await loadStats();
}

void main();
