import { STUDY_STATUS_LABEL, type StudyDetail, type StudyStatus } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, fmtDateTime, initMemberPage } from '../layout';

/** #5 스터디 — 개설·모집·참여, 주차별 진행 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('studies');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 스터디 개설
        <span class="sp"></span>
        <button class="mbtn" id="toggleForm" type="button">＋ 새 스터디</button>
      </div>
      <form class="mform" id="sForm" hidden>
        <div class="mgrid2">
          <div><label for="sTitle">제목</label><input class="mctl" id="sTitle" maxlength="80" required placeholder="모던 자바스크립트 딥다이브" /></div>
          <div><label for="sTopic">주제 태그</label><input class="mctl" id="sTopic" maxlength="40" placeholder="JavaScript" /></div>
        </div>
        <div><label for="sDesc">소개</label><textarea class="mctl" id="sDesc" required placeholder="무엇을 어떻게 공부할지, 사전 지식이 필요한지 적어주세요."></textarea></div>
        <div class="mgrid2">
          <div><label for="sSchedule">일정</label><input class="mctl" id="sSchedule" maxlength="60" placeholder="매주 화 19:00 · 동아리방" /></div>
          <div><label for="sMax">정원</label><input class="mctl" id="sMax" type="number" min="2" max="50" value="8" /></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="mbtn" type="button" id="sCancel">취소</button>
          <button class="mbtn mbtn--cy" type="submit">개설하기</button>
        </div>
      </form>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 스터디 목록 <span id="sCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <select class="mctl" id="fStatus" style="max-width:140px;padding:6px 10px">
          <option value="">상태: 전체</option>
          <option value="RECRUITING">모집 중</option>
          <option value="ONGOING">진행 중</option>
          <option value="DONE">완료</option>
        </select>
        <input class="mctl" id="fQ" placeholder="제목·주제 검색" style="max-width:180px;padding:6px 10px" />
      </div>
      <div class="cardgrid" id="sList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>

    <div class="mpanel" id="sDetail" hidden></div>`;

  const list = document.getElementById('sList')!;
  const detail = document.getElementById('sDetail')!;
  let debounce: number | undefined;

  async function load(): Promise<void> {
    try {
      const rows = await api.member.studies.list({
        status: (document.getElementById('fStatus') as HTMLSelectElement).value,
        q: (document.getElementById('fQ') as HTMLInputElement).value.trim(),
      });
      document.getElementById('sCount')!.textContent = `· ${rows.length}개`;
      list.innerHTML = rows.length
        ? rows
            .map(
              (s) => `
        <article class="scard${s.status === 'DONE' ? ' done' : ''}" data-id="${s.id}">
          <div class="scard__top">
            <span class="statuschip ${s.status.toLowerCase()}">${STUDY_STATUS_LABEL[s.status]}</span>
            ${s.topic ? `<span class="mtag">${esc(s.topic)}</span>` : ''}
            <span class="sp"></span>
            <span class="dim mono" style="font-size:11.5px">${s.memberCount}/${s.maxMembers}명</span>
          </div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.description).slice(0, 110)}</p>
          <div class="scard__foot">
            <span class="dim">👑 ${esc(s.leaderName)}</span>
            ${s.schedule ? `<span class="dim">🗓 ${esc(s.schedule)}</span>` : ''}
            <span class="sp"></span>
            ${
              s.joinedByMe
                ? '<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">참여 중</span>'
                : s.status === 'RECRUITING' && s.memberCount < s.maxMembers
                  ? `<button class="mbtn mbtn--cy" data-join="${s.id}" style="padding:4px 12px;font-size:12px">참여하기</button>`
                  : '<span class="dim" style="font-size:11.5px">모집 마감</span>'
            }
          </div>
        </article>`,
            )
            .join('')
        : '<p class="mtop__desc">아직 개설된 스터디가 없습니다. 첫 스터디를 열어보세요!</p>';

      list.querySelectorAll<HTMLElement>('.scard').forEach((card) =>
        card.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('button[data-join]')) return;
          void open(card.dataset.id!);
        }),
      );
      list.querySelectorAll<HTMLButtonElement>('[data-join]').forEach((b) =>
        b.addEventListener('click', () => {
          void api.member.studies
            .join(b.dataset.join!)
            .then(() => {
              toast('스터디에 참여했습니다.');
              void load();
            })
            .catch((e: unknown) =>
              toast(e instanceof ApiError ? e.message : '참여에 실패했습니다.'),
            );
        }),
      );
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function renderDetail(s: StudyDetail): void {
    const canManage = s.leaderId === me.id || isAdmin;
    detail.hidden = false;
    detail.innerHTML = `
      <div class="mpanel__t">// 스터디 상세 <span class="sp"></span>
        ${
          canManage
            ? `<select class="mctl" id="dStatus" style="max-width:130px;padding:5px 10px">
                 ${(['RECRUITING', 'ONGOING', 'DONE'] as StudyStatus[])
                   .map((v) => `<option value="${v}"${v === s.status ? ' selected' : ''}>${STUDY_STATUS_LABEL[v]}</option>`)
                   .join('')}
               </select>`
            : ''
        }
        <button class="mbtn" id="dClose" style="padding:4px 10px;font-size:11.5px">닫기</button>
      </div>
      <h2 style="font-size:21px">${esc(s.title)}</h2>
      <p class="mtop__desc" style="margin:6px 0 14px">
        👑 ${esc(s.leaderName)} · ${s.memberCount}/${s.maxMembers}명
        ${s.schedule ? ` · 🗓 ${esc(s.schedule)}` : ''} · 개설 ${fmtDate(s.createdAt)}
      </p>
      <div style="white-space:pre-wrap;color:var(--muted);font-size:14.5px;line-height:1.75">${esc(s.description)}</div>

      <div class="mgrid2" style="margin-top:20px">
        <div>
          <div class="mpanel__t">// 참여 부원 ${s.members.length}</div>
          ${s.members
            .map(
              (m) => `<div class="mrow" style="cursor:default">
                <span class="grow">${m.isLeader ? '👑 ' : ''}${esc(m.name)}</span>
                <span class="dim">${m.generation ? `${m.generation}기` : ''}</span></div>`,
            )
            .join('')}
          <div style="display:flex;gap:10px;margin-top:14px">
            ${
              s.joinedByMe
                ? s.leaderId === me.id
                  ? ''
                  : '<button class="mbtn mbtn--danger" id="dLeave">스터디 나가기</button>'
                : s.status !== 'DONE' && s.memberCount < s.maxMembers
                  ? '<button class="mbtn mbtn--cy" id="dJoin">참여하기</button>'
                  : ''
            }
            <a class="mbtn" href="/member/study/study-files.html?study=${s.id}">자료실 (${s.fileCount})</a>
            ${canManage ? '<button class="mbtn mbtn--danger" id="dDelete">삭제</button>' : ''}
          </div>
        </div>
        <div>
          <div class="mpanel__t">// 주차별 진행 ${s.weeks.filter((w) => w.done).length}/${s.weeks.length}</div>
          ${
            s.weeks.length
              ? s.weeks
                  .map(
                    (w) => `<div class="mrow" ${canManage ? `data-week="${w.id}"` : 'style="cursor:default"'}>
                      <span class="weekno mono">${w.weekNo}주</span>
                      <span class="grow" style="${w.done ? 'text-decoration:line-through;opacity:.55' : ''}">${esc(w.title)}</span>
                      ${w.meetAt ? `<span class="dim">${fmtDateTime(w.meetAt)}</span>` : ''}
                      <span class="${w.done ? 'mtag' : 'dim'}">${w.done ? '완료' : '예정'}</span>
                    </div>`,
                  )
                  .join('')
              : '<p class="mtop__desc">아직 등록된 주차가 없습니다.</p>'
          }
          ${
            canManage
              ? `<form class="mform" id="wForm" style="margin-top:14px;flex-direction:row;gap:8px;flex-wrap:wrap">
                   <input class="mctl" id="wTitle" placeholder="다음 주차 내용" maxlength="100" required style="flex:1;min-width:150px" />
                   <input class="mctl" id="wMeet" type="datetime-local" style="max-width:190px" />
                   <button class="mbtn mbtn--cy" type="submit">추가</button>
                 </form>`
              : ''
          }
        </div>
      </div>`;

    detail.querySelector('#dClose')!.addEventListener('click', () => {
      detail.hidden = true;
    });
    detail.querySelector('#dJoin')?.addEventListener('click', () => {
      void api.member.studies.join(s.id).then(() => {
        toast('스터디에 참여했습니다.');
        void open(s.id);
        void load();
      });
    });
    detail.querySelector('#dLeave')?.addEventListener('click', () => {
      if (!confirm('이 스터디에서 나갈까요?')) return;
      void api.member.studies
        .leave(s.id)
        .then(() => {
          toast('스터디에서 나왔습니다.');
          void open(s.id);
          void load();
        })
        .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
    });
    detail.querySelector('#dDelete')?.addEventListener('click', () => {
      if (!confirm('이 스터디를 삭제할까요? 주차·자료도 함께 사라집니다.')) return;
      void api.member.studies.remove(s.id).then(() => {
        detail.hidden = true;
        toast('삭제했습니다.');
        void load();
      });
    });
    detail.querySelector<HTMLSelectElement>('#dStatus')?.addEventListener('change', (e) => {
      const status = (e.target as HTMLSelectElement).value as StudyStatus;
      void api.member.studies.setStatus(s.id, status).then(() => {
        toast('상태를 변경했습니다.');
        void open(s.id);
        void load();
      });
    });
    detail.querySelectorAll<HTMLElement>('[data-week]').forEach((row) =>
      row.addEventListener('click', () => {
        void api.member.studies.toggleWeek(row.dataset.week!).then(() => void open(s.id));
      }),
    );
    detail.querySelector('#wForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = (detail.querySelector('#wTitle') as HTMLInputElement).value.trim();
      const meet = (detail.querySelector('#wMeet') as HTMLInputElement).value;
      if (!title) return;
      void api.member.studies
        .addWeek(s.id, { title, meetAt: meet ? new Date(meet).toISOString() : undefined })
        .then(() => {
          toast('주차를 추가했습니다.');
          void open(s.id);
        });
    });
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function open(id: string): Promise<void> {
    try {
      renderDetail(await api.member.studies.detail(id));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '스터디를 불러오지 못했습니다.');
    }
  }

  const form = document.getElementById('sForm') as HTMLFormElement;
  document.getElementById('toggleForm')!.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });
  document.getElementById('sCancel')!.addEventListener('click', () => {
    form.hidden = true;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    void api.member.studies
      .create({
        title: val('sTitle'),
        description: val('sDesc'),
        topic: val('sTopic') || undefined,
        schedule: val('sSchedule') || undefined,
        maxMembers: Number((document.getElementById('sMax') as HTMLInputElement).value) || 8,
      })
      .then(() => {
        toast('스터디를 개설했습니다. 스터디장이 되었어요!');
        form.reset();
        form.hidden = true;
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '개설에 실패했습니다.'),
      );
  });

  document.getElementById('fStatus')!.addEventListener('change', () => void load());
  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 300);
  });

  await load();
  if (location.hash.length > 1) void open(location.hash.slice(1));
}

void main();
