import { PROJECT_STATUS_LABEL, type ProjectRow, type ProjectStatus } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #11 프로젝트 — 진행 중/완료 프로젝트 목록 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('projects');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 프로젝트 등록
        <span class="sp"></span>
        <button class="mbtn" id="toggleForm" type="button">＋ 새 프로젝트</button>
      </div>
      <form class="mform" id="pForm" hidden>
        <div class="mgrid2">
          <div><label for="tName">이름</label><input class="mctl" id="tName" maxlength="80" required placeholder="학식 알림 봇" /></div>
          <div><label for="tStatus">상태</label>
            <select class="mctl" id="tStatus">
              ${(['PLANNING', 'ONGOING', 'DONE'] as ProjectStatus[])
                .map((s) => `<option value="${s}"${s === 'ONGOING' ? ' selected' : ''}>${PROJECT_STATUS_LABEL[s]}</option>`)
                .join('')}
            </select></div>
        </div>
        <div><label for="tSummary">한 줄 소개</label><input class="mctl" id="tSummary" maxlength="200" required placeholder="매일 아침 학식 메뉴를 알려주는 슬랙 봇" /></div>
        <div><label for="tDesc">설명</label><textarea class="mctl" id="tDesc" style="min-height:80px"></textarea></div>
        <div class="mgrid2">
          <div><label for="tStack">기술 스택 <span style="letter-spacing:0;color:var(--dim)">(쉼표로 구분)</span></label>
            <input class="mctl" id="tStack" placeholder="TypeScript, NestJS" /></div>
          <div><label for="tRepo">저장소 URL</label><input class="mctl" id="tRepo" maxlength="300" placeholder="https://github.com/..." /></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="mbtn" type="button" id="pCancel">취소</button>
          <button class="mbtn mbtn--cy" type="submit">등록</button>
        </div>
      </form>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 프로젝트 <span id="pCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <select class="mctl" id="fStatus" style="max-width:140px;padding:6px 10px">
          <option value="">상태: 전체</option>
          ${(['PLANNING', 'ONGOING', 'DONE', 'ARCHIVED'] as ProjectStatus[])
            .map((s) => `<option value="${s}">${PROJECT_STATUS_LABEL[s]}</option>`)
            .join('')}
        </select>
        <input class="mctl" id="fQ" placeholder="이름·기술 검색" style="max-width:180px;padding:6px 10px" />
      </div>
      <div class="cardgrid" id="pList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('pList')!;
  let debounce: number | undefined;

  function card(p: ProjectRow): string {
    const canManage = p.ownerId === me.id || isAdmin;
    return `
    <article class="pcard">
      <div class="scard__top">
        <span class="statuschip ${p.status.toLowerCase()}">${PROJECT_STATUS_LABEL[p.status]}</span>
        <span class="sp"></span>
        <span class="dim mono" style="font-size:11.5px">${fmtDate(p.createdAt)}</span>
      </div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.summary)}</p>
      ${p.description ? `<p class="dim" style="font-size:12.5px;white-space:pre-wrap">${esc(p.description).slice(0, 160)}</p>` : ''}
      <div class="pcard__stack">${p.techStack.map((t) => `<span class="mtag">${esc(t)}</span>`).join('')}</div>
      <div class="scard__foot">
        <span class="dim">👤 ${esc(p.ownerName)}${p.members.length > 1 ? ` 외 ${p.members.length - 1}명` : ''}</span>
        <span class="sp"></span>
        ${p.repoUrl ? `<a class="mbtn" href="${esc(p.repoUrl)}" target="_blank" rel="noopener noreferrer" style="padding:3px 10px;font-size:11.5px">저장소 ↗</a>` : ''}
        ${p.demoUrl ? `<a class="mbtn" href="${esc(p.demoUrl)}" target="_blank" rel="noopener noreferrer" style="padding:3px 10px;font-size:11.5px">데모 ↗</a>` : ''}
        ${
          canManage
            ? `<select class="mctl" data-status="${p.id}" style="max-width:110px;padding:3px 8px;font-size:11.5px">
                 ${(['PLANNING', 'ONGOING', 'DONE', 'ARCHIVED'] as ProjectStatus[])
                   .map((s) => `<option value="${s}"${s === p.status ? ' selected' : ''}>${PROJECT_STATUS_LABEL[s]}</option>`)
                   .join('')}
               </select>
               <button class="mbtn mbtn--danger" data-del="${p.id}" style="padding:3px 10px;font-size:11.5px">삭제</button>`
            : ''
        }
      </div>
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.projects.list({
        status: (document.getElementById('fStatus') as HTMLSelectElement).value as ProjectStatus | '',
        q: (document.getElementById('fQ') as HTMLInputElement).value.trim(),
      });
      document.getElementById('pCount')!.textContent = `· ${rows.length}개`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">아직 등록된 프로젝트가 없습니다.</p>';

      list.querySelectorAll<HTMLSelectElement>('[data-status]').forEach((s) =>
        s.addEventListener('change', () => {
          void api.member.projects
            .update(s.dataset.status!, { status: s.value })
            .then(() => {
              toast('상태를 변경했습니다.');
              void load();
            })
            .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
        }),
      );
      list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!confirm('이 프로젝트를 삭제할까요?')) return;
          void api.member.projects.remove(b.dataset.del!).then(() => {
            toast('삭제했습니다.');
            void load();
          });
        }),
      );
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
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
    void api.member.projects
      .create({
        name: val('tName'),
        summary: val('tSummary'),
        description: val('tDesc') || undefined,
        status: (document.getElementById('tStatus') as HTMLSelectElement).value,
        techStack: val('tStack')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        repoUrl: val('tRepo') || undefined,
      })
      .then(() => {
        toast('프로젝트를 등록했습니다.');
        form.reset();
        form.hidden = true;
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'),
      );
  });

  document.getElementById('fStatus')!.addEventListener('change', () => void load());
  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 300);
  });

  await load();
}

void main();
