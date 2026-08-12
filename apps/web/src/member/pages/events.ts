import type { EventRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #4 동아리 행사 — 목록 + 참가 신청/취소 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('events');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';
  let scope: 'upcoming' | 'all' = 'upcoming';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 행사 <span id="evCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <select class="mctl" id="fScope" style="max-width:150px;padding:6px 10px">
          <option value="upcoming">예정된 행사</option>
          <option value="all">전체 (지난 것 포함)</option>
        </select>
        ${isAdmin ? '<a class="mbtn" href="/member/notice/calendar.html">일정에서 추가</a>' : ''}
      </div>
      <div id="evList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('evList')!;

  function card(e: EventRow): string {
    const past = new Date(e.startsAt) < new Date();
    const full = e.capacity !== null && e.signupCount >= e.capacity;
    return `
    <article class="tpcard${past ? ' closed' : ''}">
      <div class="scard__top">
        <span class="statuschip ${e.signupOpen && !past ? 'recruiting' : 'done'}">
          ${past ? '종료' : e.signupOpen ? '신청 받는 중' : '신청 안 받음'}</span>
        ${e.kind ? `<span class="mtag">${esc(e.kind)}</span>` : ''}
        <span class="sp"></span>
        <span class="dim mono" style="font-size:11.5px">${fmtDateTime(e.startsAt)}</span>
      </div>
      <h3>${esc(e.title)}</h3>
      ${e.description ? `<p>${esc(e.description)}</p>` : ''}
      <div class="scard__foot">
        ${e.location ? `<span class="dim">📍 ${esc(e.location)}</span>` : ''}
        <span class="dim">👥 ${e.signupCount}${e.capacity ? ` / ${e.capacity}` : ''}명 신청</span>
        <span class="sp"></span>
        ${
          e.signedUpByMe
            ? `<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">신청함</span>
               <button class="mbtn" data-cancel="${e.id}" style="padding:4px 12px;font-size:12px">신청 취소</button>`
            : e.signupOpen && !past && !full
              ? `<button class="mbtn mbtn--cy" data-signup="${e.id}" style="padding:4px 12px;font-size:12px">참가 신청</button>`
              : full
                ? '<span class="dim" style="font-size:11.5px">정원 마감</span>'
                : ''
        }
        ${
          isAdmin
            ? `<button class="mbtn" data-config="${e.id}" data-open="${e.signupOpen}" style="padding:4px 12px;font-size:12px">
                 ${e.signupOpen ? '신청 닫기' : '신청 열기'}</button>
               <button class="mbtn" data-who="${e.id}" style="padding:4px 12px;font-size:12px">신청자</button>`
            : ''
        }
      </div>
      <div class="semcard__who" data-wholist="${e.id}" hidden></div>
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.events.list(scope);
      document.getElementById('evCount')!.textContent = `· ${rows.length}건`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">예정된 행사가 없습니다. 동아리 일정에서 행사를 만들고 신청을 열어보세요.</p>';
      bind();
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function bind(): void {
    const after = (msg: string) => () => {
      toast(msg);
      void load();
    };
    const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.');

    list.querySelectorAll<HTMLButtonElement>('[data-signup]').forEach((b) =>
      b.addEventListener('click', () => {
        const note = prompt('전달할 내용이 있으면 적어주세요 (선택)') ?? undefined;
        void api.member.events
          .signup(b.dataset.signup!, note?.trim() || undefined)
          .then(after('참가 신청했습니다.'))
          .catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('신청을 취소할까요?')) return;
        void api.member.events.cancel(b.dataset.cancel!).then(after('취소했습니다.')).catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-config]').forEach((b) =>
      b.addEventListener('click', () => {
        const open = b.dataset.open !== 'true';
        const capRaw = open ? prompt('정원을 입력하세요 (비우면 무제한)') : null;
        void api.member.events
          .config(b.dataset.config!, open, capRaw?.trim() ? Number(capRaw) : undefined)
          .then(after(open ? '신청을 열었습니다.' : '신청을 닫았습니다.'))
          .catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-who]').forEach((b) =>
      b.addEventListener('click', () => {
        const box = list.querySelector<HTMLElement>(`[data-wholist="${b.dataset.who}"]`)!;
        if (!box.hidden) {
          box.hidden = true;
          return;
        }
        void api.member.events.signups(b.dataset.who!).then((rows) => {
          box.hidden = false;
          box.innerHTML = rows.length
            ? rows
                .map(
                  (r) =>
                    `<span class="mtag">${esc(r.name)}${r.note ? ` <span class="dim">${esc(r.note)}</span>` : ''}</span>`,
                )
                .join('')
            : '<span class="dim" style="font-size:12px">아직 신청자가 없습니다.</span>';
        });
      }),
    );
  }

  document.getElementById('fScope')!.addEventListener('change', (e) => {
    scope = (e.target as HTMLSelectElement).value as 'upcoming' | 'all';
    void load();
  });

  await load();
}

void main();
