import type { PollRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #21 설문 / 투표 — 생성·응답·결과 그래프 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('polls');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 설문 만들기
        <span class="sp"></span>
        <button class="mbtn" id="toggleForm" type="button">＋ 새 설문</button>
      </div>
      <form class="mform" id="pForm" hidden>
        <div><label for="tTitle">질문</label><input class="mctl" id="tTitle" maxlength="120" required placeholder="이번 학기 정기 모임 요일은?" /></div>
        <div><label for="tDesc">설명 (선택)</label><input class="mctl" id="tDesc" maxlength="300" /></div>
        <div><label for="tOptions">선택지 <span style="letter-spacing:0;color:var(--dim)">(한 줄에 하나, 2개 이상)</span></label>
          <textarea class="mctl" id="tOptions" required style="min-height:100px" placeholder="화요일 저녁&#10;목요일 저녁&#10;토요일 오후"></textarea></div>
        <div class="mgrid2">
          <div><label for="tCloses">마감 (선택)</label><input class="mctl" id="tCloses" type="datetime-local" /></div>
          <div style="display:flex;gap:16px;align-items:flex-end;padding-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12.5px;color:var(--muted)">
              <input type="checkbox" id="tMultiple" /> 복수 선택
            </label>
            <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12.5px;color:var(--muted)">
              <input type="checkbox" id="tAnon" checked /> 익명
            </label>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="mbtn" type="button" id="pCancel">취소</button>
          <button class="mbtn mbtn--cy" type="submit">만들기</button>
        </div>
      </form>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 설문 <span id="pCount" style="color:var(--dim)"></span></div>
      <div id="pList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('pList')!;

  function card(p: PollRow): string {
    const canManage = p.authorId === me.id || isAdmin;
    const voted = p.myVotes.length > 0;
    return `
    <article class="pollcard${p.closed ? ' closed' : ''}">
      <div class="scard__top">
        ${p.closed ? '<span class="statuschip done">마감</span>' : '<span class="statuschip recruiting">진행 중</span>'}
        ${p.multiple ? '<span class="mtag">복수 선택</span>' : ''}
        ${p.anonymous ? '<span class="mtag">익명</span>' : '<span class="mtag">기명</span>'}
        <span class="sp"></span>
        <span class="dim mono" style="font-size:11.5px">${p.totalVoters}명 응답</span>
      </div>
      <h3>${esc(p.title)}</h3>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      <div class="polloptions">
        ${p.options
          .map((o) => {
            const mine = p.myVotes.includes(o.id);
            return `
          <button class="polloption${mine ? ' mine' : ''}" data-poll="${p.id}" data-option="${o.id}" ${p.closed ? 'disabled' : ''}>
            <span class="polloption__fill" style="width:${voted || p.closed ? o.percent : 0}%"></span>
            <span class="polloption__label">${mine ? '✓ ' : ''}${esc(o.label)}</span>
            <span class="polloption__num mono">${voted || p.closed ? `${o.percent}% · ${o.count}` : ''}</span>
          </button>`;
          })
          .join('')}
      </div>
      <div class="scard__foot">
        <span class="dim">✍ ${esc(p.authorName)}</span>
        ${p.closesAt ? `<span class="dim">마감 ${fmtDateTime(p.closesAt)}</span>` : ''}
        <span class="sp"></span>
        ${!p.anonymous || canManage ? `<button class="mbtn" data-voters="${p.id}" style="padding:3px 10px;font-size:11.5px">응답자 보기</button>` : ''}
        ${canManage ? `<button class="mbtn mbtn--danger" data-del="${p.id}" style="padding:3px 10px;font-size:11.5px">삭제</button>` : ''}
      </div>
      <div class="votersbox" data-voterlist="${p.id}" hidden></div>
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.polls.list();
      document.getElementById('pCount')!.textContent = `· ${rows.length}건`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">아직 설문이 없습니다.</p>';
      bind();
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function bind(): void {
    list.querySelectorAll<HTMLButtonElement>('[data-option]').forEach((b) =>
      b.addEventListener('click', () => {
        void api.member.polls
          .vote(b.dataset.poll!, b.dataset.option!)
          .then(() => void load())
          .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '투표에 실패했습니다.'));
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 설문을 삭제할까요?')) return;
        void api.member.polls.remove(b.dataset.del!).then(() => {
          toast('삭제했습니다.');
          void load();
        });
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-voters]').forEach((b) =>
      b.addEventListener('click', () => {
        const box = list.querySelector<HTMLElement>(`[data-voterlist="${b.dataset.voters}"]`)!;
        if (!box.hidden) {
          box.hidden = true;
          return;
        }
        void api.member.polls
          .voters(b.dataset.voters!)
          .then((rows) => {
            box.hidden = false;
            box.innerHTML = rows
              .map(
                (r) =>
                  `<div class="mrow" style="cursor:default"><span class="grow">${esc(r.optionLabel)}</span>
                   <span class="dim">${r.names.length ? r.names.map(esc).join(', ') : '없음'}</span></div>`,
              )
              .join('');
          })
          .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
      }),
    );
  }

  const form = document.getElementById('pForm') as HTMLFormElement;
  document.getElementById('toggleForm')!.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });
  document.getElementById('pCancel')!.addEventListener('click', () => {
    form.hidden = true;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    const options = val('tOptions')
      .split(/\r?\n/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (options.length < 2) {
      toast('선택지를 2개 이상 입력해 주세요.');
      return;
    }
    const closes = val('tCloses');
    void api.member.polls
      .create({
        title: val('tTitle'),
        description: val('tDesc') || undefined,
        options,
        multiple: (document.getElementById('tMultiple') as HTMLInputElement).checked,
        anonymous: (document.getElementById('tAnon') as HTMLInputElement).checked,
        closesAt: closes ? new Date(closes).toISOString() : undefined,
      })
      .then(() => {
        toast('설문을 만들었습니다.');
        form.reset();
        (document.getElementById('tAnon') as HTMLInputElement).checked = true;
        form.hidden = true;
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '생성에 실패했습니다.'),
      );
  });

  await load();
}

void main();
