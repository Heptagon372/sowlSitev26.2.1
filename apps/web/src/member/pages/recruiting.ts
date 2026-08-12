import type { ProjectRow, TeamPostRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #13 팀원 모집 — 모집글, 포지션·기술스택 필터, 지원 (수락 시 프로젝트 팀원으로 등록) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('recruiting');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  let projects: ProjectRow[] = [];
  try {
    projects = await api.member.projects.list();
  } catch {
    /* 프로젝트 연결은 선택 사항 — 실패해도 모집글은 쓸 수 있다 */
  }
  const myProjects = projects.filter((p) => p.ownerId === me.id);

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 모집글 쓰기
        <span class="sp"></span>
        <button class="mbtn" id="toggleForm" type="button">＋ 팀원 구하기</button>
      </div>
      <form class="mform" id="rForm" hidden>
        <div><label for="tTitle">제목</label><input class="mctl" id="tTitle" maxlength="100" required placeholder="학식 알림 봇 같이 만드실 분!" /></div>
        <div><label for="tBody">내용</label><textarea class="mctl" id="tBody" required placeholder="무엇을 만드는지, 어떤 사람을 찾는지, 일정은 어떤지 적어주세요."></textarea></div>
        <div class="mgrid2">
          <div><label for="tPos">모집 포지션 <span style="letter-spacing:0;color:var(--dim)">(쉼표로 구분)</span></label>
            <input class="mctl" id="tPos" placeholder="백엔드, 디자인" /></div>
          <div><label for="tStack">기술 스택</label><input class="mctl" id="tStack" placeholder="TypeScript, React" /></div>
        </div>
        <div><label for="tProject">연결할 프로젝트 (선택)</label>
          <select class="mctl" id="tProject">
            <option value="">연결 안 함</option>
            ${myProjects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
          <span class="mtop__desc">연결해 두면 지원을 수락할 때 그 프로젝트 팀원으로 자동 등록됩니다.</span>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="mbtn" type="button" id="rCancel">취소</button>
          <button class="mbtn mbtn--cy" type="submit">올리기</button>
        </div>
      </form>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 모집 중인 팀 <span id="rCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <select class="mctl" id="fStatus" style="max-width:130px;padding:6px 10px">
          <option value="OPEN">모집 중</option>
          <option value="">전체</option>
          <option value="CLOSED">마감</option>
        </select>
        <input class="mctl" id="fPos" placeholder="포지션" style="max-width:130px;padding:6px 10px" />
        <input class="mctl" id="fTech" placeholder="기술" style="max-width:130px;padding:6px 10px" />
      </div>
      <div id="rList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('rList')!;
  let debounce: number | undefined;

  function card(p: TeamPostRow): string {
    const mine = p.authorId === me.id;
    return `
    <article class="tpcard${p.status === 'CLOSED' ? ' closed' : ''}">
      <div class="scard__top">
        <span class="statuschip ${p.status === 'OPEN' ? 'recruiting' : 'done'}">${p.status === 'OPEN' ? '모집 중' : '마감'}</span>
        ${p.projectName ? `<span class="mtag">🔗 ${esc(p.projectName)}</span>` : ''}
        <span class="sp"></span>
        <span class="dim mono" style="font-size:11.5px">${fmtDate(p.createdAt)}</span>
      </div>
      <h3>${esc(p.title)}</h3>
      <p style="white-space:pre-wrap">${esc(p.body)}</p>
      <div class="pcard__stack">
        ${p.positions.map((x) => `<span class="mtag" style="border-color:rgba(244,114,208,.35);color:var(--magenta-hi)">${esc(x)}</span>`).join('')}
        ${p.techStack.map((x) => `<span class="mtag">${esc(x)}</span>`).join('')}
      </div>
      <div class="scard__foot">
        <span class="dim">✍ ${esc(p.authorName)}</span>
        <span class="dim">지원 ${p.applicationCount}명</span>
        <span class="sp"></span>
        ${
          mine || isAdmin
            ? `<button class="mbtn" data-toggle="${p.id}" style="padding:4px 12px;font-size:12px">${p.status === 'OPEN' ? '마감하기' : '다시 열기'}</button>
               <button class="mbtn mbtn--danger" data-del="${p.id}" style="padding:4px 12px;font-size:12px">삭제</button>`
            : p.appliedByMe
              ? '<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">지원함</span>'
              : p.status === 'OPEN'
                ? `<button class="mbtn mbtn--cy" data-apply="${p.id}" style="padding:4px 12px;font-size:12px">지원하기</button>`
                : ''
        }
      </div>
      ${
        mine && p.applications.length
          ? `<div class="applist">
               <div class="mpanel__t" style="margin:14px 0 8px">// 지원자 ${p.applications.length}</div>
               ${p.applications
                 .map(
                   (a) => `
                 <div class="approw">
                   <b>${esc(a.userName)}</b>
                   ${a.position ? `<span class="mtag">${esc(a.position)}</span>` : ''}
                   <span class="grow">${esc(a.message)}</span>
                   ${
                     a.status === 'PENDING'
                       ? `<button class="mbtn mbtn--cy" data-accept="${a.id}" style="padding:3px 10px;font-size:11px">수락</button>
                          <button class="mbtn" data-reject="${a.id}" style="padding:3px 10px;font-size:11px">거절</button>`
                       : `<span class="mtag" style="${a.status === 'ACCEPTED' ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : 'color:var(--dim)'}">${a.status === 'ACCEPTED' ? '수락됨' : '거절됨'}</span>`
                   }
                 </div>`,
                 )
                 .join('')}
             </div>`
          : ''
      }
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.teamPosts.list({
        status: (document.getElementById('fStatus') as HTMLSelectElement).value,
        position: (document.getElementById('fPos') as HTMLInputElement).value.trim(),
        tech: (document.getElementById('fTech') as HTMLInputElement).value.trim(),
      });
      document.getElementById('rCount')!.textContent = `· ${rows.length}건`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">조건에 맞는 모집글이 없습니다.</p>';
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

    list.querySelectorAll<HTMLButtonElement>('[data-apply]').forEach((b) =>
      b.addEventListener('click', () => {
        const message = prompt('지원 메시지를 남겨주세요 (어떤 걸 맡고 싶은지, 가능한 시간 등)');
        if (!message?.trim()) return;
        const position = prompt('희망 포지션 (선택 — 비워도 됩니다)') ?? undefined;
        void api.member.teamPosts
          .apply(b.dataset.apply!, message.trim(), position?.trim() || undefined)
          .then(after('지원했습니다.'))
          .catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () =>
        void api.member.teamPosts.toggle(b.dataset.toggle!).then(after('변경했습니다.')).catch(fail),
      ),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 모집글을 삭제할까요?')) return;
        void api.member.teamPosts.remove(b.dataset.del!).then(after('삭제했습니다.')).catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach((b) =>
      b.addEventListener('click', () =>
        void api.member.teamPosts
          .decide(b.dataset.accept!, true)
          .then(after('수락했습니다. 연결된 프로젝트가 있으면 팀원으로 등록됩니다.'))
          .catch(fail),
      ),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach((b) =>
      b.addEventListener('click', () =>
        void api.member.teamPosts.decide(b.dataset.reject!, false).then(after('거절했습니다.')).catch(fail),
      ),
    );
  }

  const form = document.getElementById('rForm') as HTMLFormElement;
  document.getElementById('toggleForm')!.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });
  document.getElementById('rCancel')!.addEventListener('click', () => {
    form.hidden = true;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    const split = (v: string) =>
      v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    void api.member.teamPosts
      .create({
        title: val('tTitle'),
        body: val('tBody'),
        positions: split(val('tPos')),
        techStack: split(val('tStack')),
        projectId: (document.getElementById('tProject') as HTMLSelectElement).value || undefined,
      })
      .then(() => {
        toast('모집글을 올렸습니다.');
        form.reset();
        form.hidden = true;
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'),
      );
  });

  document.getElementById('fStatus')!.addEventListener('change', () => void load());
  for (const id of ['fPos', 'fTech']) {
    document.getElementById(id)!.addEventListener('input', () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void load(), 300);
    });
  }

  await load();
}

void main();
