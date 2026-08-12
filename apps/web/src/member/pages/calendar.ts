import type { EventRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #3 동아리 일정 — 월간 캘린더 + iCal 내보내기 (+ 관리자 일정 추가) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('calendar');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-based

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">
        <button class="mbtn" id="calPrev" style="padding:4px 12px">←</button>
        <span id="calTitle" style="font-size:15px;color:var(--text);letter-spacing:0"></span>
        <button class="mbtn" id="calNext" style="padding:4px 12px">→</button>
        <span class="sp"></span>
        <a class="mbtn" id="calIcs" href="#">iCal 내보내기</a>
      </div>
      <div class="mcal" id="calGrid"></div>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 이 달의 일정</div>
      <div id="calList"></div>
    </div>
    ${
      isAdmin
        ? `<div class="mpanel">
            <div class="mpanel__t">// 일정 추가 (관리자)</div>
            <form class="mform" id="evForm">
              <div class="mgrid2">
                <div><label for="evTitle">제목</label><input class="mctl" id="evTitle" required maxlength="150" /></div>
                <div><label for="evLoc">장소</label><input class="mctl" id="evLoc" maxlength="100" /></div>
              </div>
              <div class="mgrid2">
                <div><label for="evStart">시작</label><input class="mctl" id="evStart" type="datetime-local" required /></div>
                <div><label for="evEnd">종료 (선택)</label><input class="mctl" id="evEnd" type="datetime-local" /></div>
              </div>
              <div class="mgrid2">
                <div><label for="evKind">분류</label>
                  <select class="mctl" id="evKind">
                    <option value="MEETING">모임</option><option value="SEMINAR">세미나</option>
                    <option value="STUDY">스터디</option><option value="HACKATHON">해커톤</option>
                    <option value="ETC">기타</option>
                  </select></div>
                <div><label for="evDesc">설명 (선택)</label><input class="mctl" id="evDesc" /></div>
              </div>
              <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">일정 추가</button></div>
            </form>
          </div>`
        : ''
    }`;

  const icsLink = document.getElementById('calIcs') as HTMLAnchorElement;
  icsLink.href = api.member.calendar.icalUrl();

  async function load(): Promise<void> {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    document.getElementById('calTitle')!.textContent = `${year}년 ${month + 1}월`;

    let events: EventRow[] = [];
    try {
      events = await api.member.calendar.month(key);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '일정을 불러오지 못했습니다.');
    }

    // 달력 그리드
    const grid = document.getElementById('calGrid')!;
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const cells: string[] = ['일', '월', '화', '수', '목', '금', '토'].map(
      (d) => `<div class="mcal__dow">${d}</div>`,
    );
    for (let i = 0; i < startDow; i++) cells.push('<div class="mcal__cell out"></div>');
    for (let d = 1; d <= days; d++) {
      const isToday =
        d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const dayEvents = events.filter((e) => new Date(e.startsAt).getDate() === d);
      cells.push(`
        <div class="mcal__cell${isToday ? ' today' : ''}">
          ${d}
          ${dayEvents.map((e) => `<span class="mcal__ev" title="${esc(e.title)}">${esc(e.title)}</span>`).join('')}
        </div>`);
    }
    grid.innerHTML = cells.join('');

    // 목록
    const list = document.getElementById('calList')!;
    list.innerHTML = events.length
      ? events
          .map(
            (e) => `
        <div class="mrow" style="cursor:default" data-id="${e.id}">
          <span class="mtag">${esc(e.kind ?? 'ETC')}</span>
          <span class="grow">${esc(e.title)}${e.description ? ` <span class="dim">— ${esc(e.description)}</span>` : ''}</span>
          ${e.location ? `<span class="dim">@ ${esc(e.location)}</span>` : ''}
          <span class="dim">${fmtDateTime(e.startsAt)}</span>
          ${isAdmin ? `<button class="mbtn mbtn--danger" data-del="${e.id}" style="padding:3px 10px;font-size:11px">삭제</button>` : ''}
        </div>`,
          )
          .join('')
      : '<p class="mtop__desc">이 달에는 일정이 없습니다.</p>';

    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 일정을 삭제할까요?')) return;
        void api.member.calendar.remove(b.dataset.del!).then(() => void load());
      }),
    );
  }

  document.getElementById('calPrev')!.addEventListener('click', () => {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    void load();
  });
  document.getElementById('calNext')!.addEventListener('click', () => {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    void load();
  });

  document.getElementById('evForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    if (!val('evTitle').trim() || !val('evStart')) return;
    void api.member.calendar
      .create({
        title: val('evTitle').trim(),
        location: val('evLoc').trim() || undefined,
        startsAt: new Date(val('evStart')).toISOString(),
        endsAt: val('evEnd') ? new Date(val('evEnd')).toISOString() : undefined,
        kind: (document.getElementById('evKind') as HTMLSelectElement).value,
        description: val('evDesc').trim() || undefined,
      })
      .then(() => {
        toast('일정을 추가했습니다.');
        (document.getElementById('evForm') as HTMLFormElement).reset();
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '추가에 실패했습니다.'),
      );
  });

  await load();
}

void main();
