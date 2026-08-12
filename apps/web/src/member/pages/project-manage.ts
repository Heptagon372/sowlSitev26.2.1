import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type KanbanBoard,
  type ProjectRow,
  type TaskStatus,
} from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #12 프로젝트 관리 — 칸반 보드 · 마일스톤 · 담당자 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('project-manage');
  if (!ctx) return;
  const { content } = ctx;

  let projects: ProjectRow[] = [];
  let current = new URLSearchParams(location.search).get('project') ?? '';
  let board: KanbanBoard | null = null;

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 프로젝트 선택
        <span class="sp"></span>
        <select class="mctl" id="projSel" style="max-width:300px;padding:6px 10px"></select>
      </div>
      <p class="mtop__desc" id="projInfo">보드를 볼 프로젝트를 고르세요.</p>
    </div>

    <div id="boardWrap" hidden>
      <div class="mpanel">
        <div class="mpanel__t">// 마일스톤 <span class="sp"></span>
          <button class="mbtn" id="msAdd" style="padding:4px 12px">＋ 마일스톤</button>
        </div>
        <div id="msList"></div>
      </div>

      <div class="mpanel">
        <div class="mpanel__t">// 태스크 추가</div>
        <form class="mform" id="taskForm" style="flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center">
          <input class="mctl" id="tTitle" placeholder="할 일" maxlength="150" required style="flex:1;min-width:180px" />
          <select class="mctl" id="tAssignee" style="max-width:150px"></select>
          <select class="mctl" id="tMilestone" style="max-width:170px"></select>
          <input class="mctl" id="tDue" type="date" style="max-width:150px" />
          <button class="mbtn mbtn--cy" type="submit">추가</button>
        </form>
      </div>

      <div class="kanban" id="kanban"></div>
    </div>`;

  const sel = document.getElementById('projSel') as HTMLSelectElement;
  const wrap = document.getElementById('boardWrap')!;

  async function loadBoard(): Promise<void> {
    wrap.hidden = !current;
    if (!current) return;
    try {
      board = await api.member.kanban.board(current);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '보드를 불러오지 못했습니다.');
      return;
    }

    document.getElementById('projInfo')!.textContent = board.canManage
      ? `${board.projectName} · 팀원 ${board.members.length}명 — 카드를 드래그해 상태를 바꿀 수 있습니다.`
      : `${board.projectName} — 팀원만 수정할 수 있습니다 (보기 전용).`;

    // 담당자·마일스톤 선택지
    (document.getElementById('tAssignee') as HTMLSelectElement).innerHTML =
      '<option value="">담당자 없음</option>' +
      board.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    (document.getElementById('tMilestone') as HTMLSelectElement).innerHTML =
      '<option value="">마일스톤 없음</option>' +
      board.milestones.map((m) => `<option value="${m.id}">${esc(m.title)}</option>`).join('');

    document.getElementById('msList')!.innerHTML = board.milestones.length
      ? board.milestones
          .map(
            (m) => `
        <div class="mrow" style="cursor:default">
          <span class="${m.done ? 'mtag' : 'dim'}" style="${m.done ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : ''}">${m.done ? '완료' : '진행'}</span>
          <span class="grow">${esc(m.title)}</span>
          <span class="dim">${m.doneCount}/${m.taskCount} 태스크</span>
          ${m.dueAt ? `<span class="dim">~ ${fmtDate(m.dueAt)}</span>` : ''}
          ${
            board!.canManage
              ? `<button class="mbtn" data-mstoggle="${m.id}" style="padding:3px 10px;font-size:11px">${m.done ? '되돌리기' : '완료'}</button>
                 <button class="mbtn mbtn--danger" data-msdel="${m.id}" style="padding:3px 10px;font-size:11px">삭제</button>`
              : ''
          }
        </div>`,
          )
          .join('')
      : '<p class="mtop__desc">마일스톤이 없습니다.</p>';

    // 칸반 컬럼
    document.getElementById('kanban')!.innerHTML = TASK_STATUSES.map((status) => {
      const tasks = board!.tasks.filter((t) => t.status === status);
      return `
      <div class="kcol" data-status="${status}">
        <div class="kcol__head">${TASK_STATUS_LABEL[status]} <span class="dim">${tasks.length}</span></div>
        <div class="kcol__body">
          ${tasks
            .map(
              (t) => `
            <article class="kcard" draggable="${board!.canManage}" data-task="${t.id}">
              <div class="kcard__title">${esc(t.title)}</div>
              <div class="kcard__meta">
                ${t.assigneeName ? `<span class="mtag">${esc(t.assigneeName)}</span>` : ''}
                ${t.milestoneTitle ? `<span class="dim">🏁 ${esc(t.milestoneTitle)}</span>` : ''}
                ${t.dueAt ? `<span class="dim">${fmtDate(t.dueAt)}</span>` : ''}
              </div>
              ${board!.canManage ? `<button class="kcard__del" data-tdel="${t.id}" aria-label="삭제">✕</button>` : ''}
            </article>`,
            )
            .join('')}
        </div>
      </div>`;
    }).join('');

    bindBoard();
  }

  function bindBoard(): void {
    if (!board?.canManage) return;
    const after = (msg: string) => () => {
      toast(msg);
      void loadBoard();
    };
    const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.');

    document.querySelectorAll<HTMLElement>('.kcard[draggable="true"]').forEach((card) =>
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('text/plain', card.dataset.task!);
      }),
    );
    document.querySelectorAll<HTMLElement>('.kcol').forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('over');
      });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('over');
        const id = (e as DragEvent).dataTransfer?.getData('text/plain');
        if (!id) return;
        void api.member.kanban
          .updateTask(id, { status: col.dataset.status as TaskStatus })
          .then(() => void loadBoard())
          .catch(fail);
      });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-tdel]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('이 태스크를 삭제할까요?')) return;
        void api.member.kanban.removeTask(b.dataset.tdel!).then(after('삭제했습니다.')).catch(fail);
      }),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-mstoggle]').forEach((b) =>
      b.addEventListener('click', () =>
        void api.member.kanban.toggleMilestone(b.dataset.mstoggle!).then(after('변경했습니다.')).catch(fail),
      ),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-msdel]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 마일스톤을 삭제할까요? 태스크는 남습니다.')) return;
        void api.member.kanban.removeMilestone(b.dataset.msdel!).then(after('삭제했습니다.')).catch(fail);
      }),
    );
  }

  document.getElementById('taskForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    if (!val('tTitle').trim() || !current) return;
    void api.member.kanban
      .createTask(current, {
        title: val('tTitle').trim(),
        assigneeId: val('tAssignee') || undefined,
        milestoneId: val('tMilestone') || undefined,
        dueAt: val('tDue') ? new Date(val('tDue')).toISOString() : undefined,
      })
      .then(() => {
        (document.getElementById('taskForm') as HTMLFormElement).reset();
        void loadBoard();
      })
      .catch((err: unknown) => toast(err instanceof ApiError ? err.message : '추가에 실패했습니다.'));
  });

  document.getElementById('msAdd')!.addEventListener('click', () => {
    const title = prompt('마일스톤 이름');
    if (!title?.trim() || !current) return;
    const due = prompt('마감일 (YYYY-MM-DD, 비워도 됩니다)');
    void api.member.kanban
      .createMilestone(current, {
        title: title.trim(),
        dueAt: due?.trim() ? new Date(due).toISOString() : undefined,
      })
      .then(() => void loadBoard())
      .catch((err: unknown) => toast(err instanceof ApiError ? err.message : '추가에 실패했습니다.'));
  });

  sel.addEventListener('change', () => {
    current = sel.value;
    const url = new URL(location.href);
    if (current) url.searchParams.set('project', current);
    else url.searchParams.delete('project');
    history.replaceState(null, '', url);
    void loadBoard();
  });

  try {
    projects = await api.member.projects.list();
  } catch {
    toast('프로젝트 목록을 불러오지 못했습니다.');
  }
  sel.innerHTML =
    '<option value="">— 프로젝트를 선택하세요 —</option>' +
    projects
      .map((p) => `<option value="${p.id}"${p.id === current ? ' selected' : ''}>${esc(p.name)}</option>`)
      .join('');
  if (!current) current = projects[0]?.id ?? '';
  sel.value = current;
  await loadBoard();
}

void main();
