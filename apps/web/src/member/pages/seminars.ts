import type { SeminarRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #7 세미나 — 발표 일정, 발표자 신청, 슬라이드, 출석 열기 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('seminars');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    ${
      isAdmin
        ? `<div class="mpanel">
            <div class="mpanel__t">// 세미나 등록 (관리자)</div>
            <form class="mform" id="semForm">
              <div class="mgrid2">
                <div><label for="tTitle">제목</label><input class="mctl" id="tTitle" maxlength="100" required placeholder="Docker 입문 — 컨테이너가 뭔가요" /></div>
                <div><label for="tStart">일시</label><input class="mctl" id="tStart" type="datetime-local" required /></div>
              </div>
              <div class="mgrid2">
                <div><label for="tLoc">장소</label><input class="mctl" id="tLoc" maxlength="80" placeholder="동아리방" /></div>
                <div><label for="tPoints">출석 포인트</label><input class="mctl" id="tPoints" type="number" min="0" max="100" value="5" /></div>
              </div>
              <div><label for="tDesc">설명</label><textarea class="mctl" id="tDesc" style="min-height:70px"></textarea></div>
              <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">등록</button></div>
            </form>
          </div>`
        : ''
    }
    <div class="mpanel">
      <div class="mpanel__t">// 세미나 <span id="semCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <a class="mbtn" href="/member/study/seminar-attendance.html">출석 체크 →</a>
      </div>
      <div id="semList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('semList')!;

  function card(s: SeminarRow): string {
    const past = new Date(s.startsAt) < new Date();
    const mine = s.speakerId === me.id;
    return `
    <article class="semcard${past ? ' past' : ''}" data-id="${s.id}">
      <div class="semcard__date mono">
        <b>${new Date(s.startsAt).getMonth() + 1}/${new Date(s.startsAt).getDate()}</b>
        <span>${new Date(s.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="semcard__body">
        <h3>${esc(s.title)}
          ${s.codeOpen ? '<span class="livechip">출석 열림</span>' : ''}
          ${s.attendedByMe ? '<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">출석함</span>' : ''}
        </h3>
        ${s.description ? `<p>${esc(s.description)}</p>` : ''}
        <div class="semcard__meta">
          <span class="dim">🎤 ${s.speakerName ? esc(s.speakerName) : '발표자 모집 중'}</span>
          ${s.location ? `<span class="dim">📍 ${esc(s.location)}</span>` : ''}
          <span class="dim">👥 ${s.attendeeCount}명 출석</span>
          <span class="dim">+${s.points}pt</span>
          ${s.slideUrl ? `<a href="${esc(s.slideUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">슬라이드 ↗</a>` : ''}
        </div>
        <div class="semcard__actions">
          ${
            !s.speakerId
              ? `<button class="mbtn mbtn--cy" data-claim="${s.id}" style="padding:4px 12px;font-size:12px">발표자 신청</button>`
              : mine
                ? `<button class="mbtn" data-claim="${s.id}" style="padding:4px 12px;font-size:12px">발표 취소</button>`
                : ''
          }
          ${
            mine || isAdmin
              ? `<button class="mbtn" data-slide="${s.id}" style="padding:4px 12px;font-size:12px">슬라이드 등록</button>
                 ${
                   s.codeOpen
                     ? `<button class="mbtn mbtn--danger" data-close="${s.id}" style="padding:4px 12px;font-size:12px">출석 닫기</button>
                        <span class="codechip mono">CODE ${esc(s.attendCode ?? '')}</span>`
                     : `<button class="mbtn mbtn--cy" data-open="${s.id}" style="padding:4px 12px;font-size:12px">출석 열기</button>`
                 }
                 <button class="mbtn" data-who="${s.id}" style="padding:4px 12px;font-size:12px">출석자 보기</button>`
              : ''
          }
          ${isAdmin ? `<button class="mbtn mbtn--danger" data-del="${s.id}" style="padding:4px 12px;font-size:12px">삭제</button>` : ''}
        </div>
        <div class="semcard__who" data-wholist="${s.id}" hidden></div>
      </div>
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.seminars.list();
      document.getElementById('semCount')!.textContent = `· ${rows.length}회`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">등록된 세미나가 없습니다.</p>';
      bind();
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function bind(): void {
    const wrap = <T>(p: Promise<T>) =>
      p
        .then(() => void load())
        .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));

    list.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((b) =>
      b.addEventListener('click', () => void wrap(api.member.seminars.claimSpeaker(b.dataset.claim!))),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-slide]').forEach((b) =>
      b.addEventListener('click', () => {
        const url = prompt('슬라이드 URL을 입력하세요 (비우면 삭제)');
        if (url === null) return;
        void wrap(api.member.seminars.setSlide(b.dataset.slide!, url.trim()));
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) =>
      b.addEventListener('click', () => {
        void api.member.seminars
          .openCode(b.dataset.open!)
          .then((r) => {
            toast(`출석 코드 ${r.code} — 15분간 유효합니다.`);
            void load();
          })
          .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((b) =>
      b.addEventListener('click', () => void wrap(api.member.seminars.closeCode(b.dataset.close!))),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 세미나를 삭제할까요?')) return;
        void wrap(api.member.seminars.remove(b.dataset.del!));
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-who]').forEach((b) =>
      b.addEventListener('click', () => {
        const box = list.querySelector<HTMLElement>(`[data-wholist="${b.dataset.who}"]`)!;
        if (!box.hidden) {
          box.hidden = true;
          return;
        }
        void api.member.seminars.attendees(b.dataset.who!).then((rows) => {
          box.hidden = false;
          box.innerHTML = rows.length
            ? rows
                .map(
                  (r) =>
                    `<span class="mtag">${esc(r.name)} <span class="dim">${fmtDateTime(r.checkedAt).slice(11)}</span></span>`,
                )
                .join('')
            : '<span class="dim" style="font-size:12px">아직 출석한 부원이 없습니다.</span>';
        });
      }),
    );
  }

  document.getElementById('semForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    void api.member.seminars
      .create({
        title: val('tTitle'),
        startsAt: new Date(val('tStart')).toISOString(),
        location: val('tLoc') || undefined,
        description: val('tDesc') || undefined,
        points: Number((document.getElementById('tPoints') as HTMLInputElement).value) || 5,
      })
      .then(() => {
        toast('세미나를 등록했습니다.');
        (document.getElementById('semForm') as HTMLFormElement).reset();
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'),
      );
  });

  await load();
}

void main();
