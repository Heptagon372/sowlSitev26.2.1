import type { MissionDetail } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #9 과제 / 미션 — 목록·제출·마감·피드백 (채점하면 포인트가 지급된다) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('missions');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    ${
      isAdmin
        ? `<div class="mpanel">
            <div class="mpanel__t">// 과제 출제 (관리자)</div>
            <form class="mform" id="mForm">
              <div class="mgrid2">
                <div><label for="tTitle">제목</label><input class="mctl" id="tTitle" maxlength="100" required /></div>
                <div><label for="tDue">마감</label><input class="mctl" id="tDue" type="datetime-local" required /></div>
              </div>
              <div><label for="tBody">내용</label><textarea class="mctl" id="tBody" required placeholder="무엇을 어떻게 제출해야 하는지 적어주세요."></textarea></div>
              <div class="mgrid2">
                <div><label for="tPoints">만점 포인트</label><input class="mctl" id="tPoints" type="number" min="0" max="100" value="10" /></div>
                <div></div>
              </div>
              <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">출제</button></div>
            </form>
          </div>`
        : ''
    }
    <div class="mpanel">
      <div class="mpanel__t">// 과제 <span id="mCount" style="color:var(--dim)"></span></div>
      <div id="mList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>
    <div class="mpanel" id="mDetail" hidden></div>`;

  const list = document.getElementById('mList')!;
  const detail = document.getElementById('mDetail')!;

  async function load(): Promise<void> {
    try {
      const rows = await api.member.missions.list();
      document.getElementById('mCount')!.textContent = `· ${rows.length}건`;
      const now = Date.now();
      list.innerHTML = rows.length
        ? rows
            .map((m) => {
              const overdue = new Date(m.dueAt).getTime() < now;
              const state = m.myScore !== null
                ? `<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">${m.myScore}점</span>`
                : m.mySubmitted
                  ? '<span class="mtag">제출함</span>'
                  : overdue
                    ? '<span class="mtag" style="border-color:rgba(251,113,133,.4);color:var(--danger)">미제출</span>'
                    : '<span class="dim">진행 중</span>';
              return `
          <div class="mrow" data-id="${m.id}" role="button" tabindex="0">
            ${state}
            <span class="grow">${esc(m.title)}</span>
            <span class="dim">+${m.points}pt</span>
            ${isAdmin ? `<span class="dim">제출 ${m.submissionCount}</span>` : ''}
            <span class="dim" style="${overdue ? 'color:var(--danger)' : ''}">마감 ${fmtDateTime(m.dueAt)}</span>
          </div>`;
            })
            .join('')
        : '<p class="mtop__desc">아직 출제된 과제가 없습니다.</p>';

      list.querySelectorAll<HTMLElement>('[data-id]').forEach((row) =>
        row.addEventListener('click', () => void open(row.dataset.id!)),
      );
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function renderDetail(m: MissionDetail): void {
    const overdue = new Date(m.dueAt).getTime() < Date.now();
    detail.hidden = false;
    detail.innerHTML = `
      <div class="mpanel__t">// 과제 상세 <span class="sp"></span>
        ${isAdmin ? `<button class="mbtn mbtn--danger" id="dDel" style="padding:4px 10px;font-size:11.5px">삭제</button>` : ''}
        <button class="mbtn" id="dClose" style="padding:4px 10px;font-size:11.5px">닫기</button>
      </div>
      <h2 style="font-size:20px">${esc(m.title)}</h2>
      <p class="mtop__desc" style="margin:6px 0 14px">
        마감 ${fmtDateTime(m.dueAt)} ${overdue ? '· <b style="color:var(--danger)">마감됨</b>' : ''} · 만점 ${m.points}pt
      </p>
      <div style="white-space:pre-wrap;color:var(--muted);font-size:14.5px;line-height:1.75">${esc(m.body)}</div>

      <div class="mpanel__t" style="margin-top:22px">// 내 제출물</div>
      ${
        m.mySubmission
          ? `<div class="subcard">
               <div class="subcard__head">
                 <span class="dim">제출 ${fmtDateTime(m.mySubmission.submittedAt)}</span>
                 ${m.mySubmission.score !== null ? `<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">${m.mySubmission.score} / ${m.points}점</span>` : '<span class="dim">채점 대기</span>'}
               </div>
               <div style="white-space:pre-wrap;font-size:14px">${esc(m.mySubmission.content)}</div>
               ${m.mySubmission.link ? `<a href="${esc(m.mySubmission.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);font-size:13px">${esc(m.mySubmission.link)} ↗</a>` : ''}
               ${m.mySubmission.feedback ? `<div class="feedback"><b>피드백</b><br />${esc(m.mySubmission.feedback)}</div>` : ''}
             </div>`
          : ''
      }
      <form class="mform" id="subForm" style="margin-top:12px">
        <div><label for="subContent">${m.mySubmission ? '다시 제출하기' : '제출 내용'}</label>
          <textarea class="mctl" id="subContent" required placeholder="무엇을 했는지 적어주세요.">${esc(m.mySubmission?.content ?? '')}</textarea></div>
        <div style="display:flex;gap:10px;align-items:flex-end">
          <div style="flex:1"><label for="subLink">링크 (선택)</label>
            <input class="mctl" id="subLink" maxlength="300" placeholder="https://github.com/..." value="${esc(m.mySubmission?.link ?? '')}" /></div>
          <button class="mbtn mbtn--cy" type="submit">${m.mySubmission ? '재제출' : '제출'}${overdue ? ' (지각)' : ''}</button>
        </div>
      </form>

      ${
        isAdmin
          ? `<div class="mpanel__t" style="margin-top:24px">// 제출물 ${m.submissions.length}건 (관리자)</div>
             <div id="subList">${
               m.submissions.length
                 ? m.submissions
                     .map(
                       (s) => `
                   <div class="subcard">
                     <div class="subcard__head">
                       <b>${esc(s.userName)}</b>
                       <span class="dim">${fmtDateTime(s.submittedAt)}</span>
                       <span class="sp" style="flex:1"></span>
                       ${s.score !== null ? `<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">${s.score}점</span>` : '<span class="dim">미채점</span>'}
                     </div>
                     <div style="white-space:pre-wrap;font-size:13.5px">${esc(s.content)}</div>
                     ${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);font-size:13px">${esc(s.link)} ↗</a>` : ''}
                     <form class="reviewform" data-sub="${s.id}">
                       <input class="mctl" type="number" min="0" max="${m.points}" value="${s.score ?? ''}" placeholder="점수" style="max-width:90px" required />
                       <input class="mctl" maxlength="1000" placeholder="피드백 (선택)" value="${esc(s.feedback ?? '')}" style="flex:1" />
                       <button class="mbtn" type="submit">채점</button>
                     </form>
                   </div>`,
                     )
                     .join('')
                 : '<p class="mtop__desc">아직 제출물이 없습니다.</p>'
             }</div>`
          : ''
      }`;

    detail.querySelector('#dClose')!.addEventListener('click', () => {
      detail.hidden = true;
    });
    detail.querySelector('#dDel')?.addEventListener('click', () => {
      if (!confirm('이 과제를 삭제할까요? 제출물도 함께 사라집니다.')) return;
      void api.member.missions.remove(m.id).then(() => {
        detail.hidden = true;
        toast('삭제했습니다.');
        void load();
      });
    });
    detail.querySelector('#subForm')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const contentEl = detail.querySelector('#subContent') as HTMLTextAreaElement;
      const linkEl = detail.querySelector('#subLink') as HTMLInputElement;
      if (!contentEl.value.trim()) return;
      void api.member.missions
        .submit(m.id, contentEl.value.trim(), linkEl.value.trim() || undefined)
        .then(() => {
          toast('제출했습니다.');
          void open(m.id);
          void load();
        })
        .catch((err: unknown) =>
          toast(err instanceof ApiError ? err.message : '제출에 실패했습니다.'),
        );
    });
    detail.querySelectorAll<HTMLFormElement>('.reviewform').forEach((f) =>
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const [scoreEl, fbEl] = Array.from(f.querySelectorAll('input')) as HTMLInputElement[];
        void api.member.missions
          .review(f.dataset.sub!, Number(scoreEl.value), fbEl.value.trim() || undefined)
          .then(() => {
            toast('채점했습니다. 포인트가 지급됩니다.');
            void open(m.id);
            void load();
          })
          .catch((err: unknown) =>
            toast(err instanceof ApiError ? err.message : '채점에 실패했습니다.'),
          );
      }),
    );
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function open(id: string): Promise<void> {
    try {
      renderDetail(await api.member.missions.detail(id));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '과제를 불러오지 못했습니다.');
    }
  }

  document.getElementById('mForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    void api.member.missions
      .create({
        title: val('tTitle'),
        body: val('tBody'),
        dueAt: new Date(val('tDue')).toISOString(),
        points: Number((document.getElementById('tPoints') as HTMLInputElement).value) || 10,
      })
      .then(() => {
        toast('과제를 출제했습니다.');
        (document.getElementById('mForm') as HTMLFormElement).reset();
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '출제에 실패했습니다.'),
      );
  });

  await load();
  if (location.hash.length > 1) void open(location.hash.slice(1));
}

void main();
