import type { QuestionDetail } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #19 질문 / Q&A — 질문·답변, 채택, 태그 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('qna');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 질문하기
        <span class="sp"></span>
        <button class="mbtn" id="toggleForm" type="button">＋ 새 질문</button>
      </div>
      <form class="mform" id="qForm" hidden>
        <div><label for="tTitle">제목</label><input class="mctl" id="tTitle" maxlength="120" required placeholder="Prisma에서 관계 쿼리가 느린데 어떻게 하나요?" /></div>
        <div><label for="tBody">내용</label><textarea class="mctl" id="tBody" required placeholder="무엇을 시도했고 어디서 막혔는지 적으면 답변이 빨라져요."></textarea></div>
        <div><label for="tTags">태그 <span style="letter-spacing:0;color:var(--dim)">(쉼표로 구분, 최대 5개)</span></label>
          <input class="mctl" id="tTags" placeholder="Prisma, DB" /></div>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="mbtn" type="button" id="qCancel">취소</button>
          <button class="mbtn mbtn--cy" type="submit">질문 올리기</button>
        </div>
      </form>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 질문 <span id="qCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--muted)">
          <input type="checkbox" id="fUnsolved" /> 미해결만
        </label>
        <input class="mctl" id="fTag" placeholder="태그" style="max-width:120px;padding:6px 10px" />
        <input class="mctl" id="fQ" placeholder="검색" style="max-width:160px;padding:6px 10px" />
      </div>
      <div id="qList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>

    <div class="mpanel" id="qDetail" hidden></div>`;

  const list = document.getElementById('qList')!;
  const detail = document.getElementById('qDetail')!;
  let debounce: number | undefined;

  async function load(): Promise<void> {
    try {
      const rows = await api.member.qna.list({
        q: (document.getElementById('fQ') as HTMLInputElement).value.trim() || undefined,
        tag: (document.getElementById('fTag') as HTMLInputElement).value.trim() || undefined,
        unsolved: (document.getElementById('fUnsolved') as HTMLInputElement).checked,
      });
      document.getElementById('qCount')!.textContent = `· ${rows.length}건`;
      list.innerHTML = rows.length
        ? rows
            .map(
              (q) => `
        <div class="mrow" data-id="${q.id}" role="button" tabindex="0">
          <span class="answerchip${q.solved ? ' solved' : ''}">
            <b>${q.answerCount}</b><span>답변</span>
          </span>
          <span class="grow">${q.solved ? '✅ ' : ''}${esc(q.title)}
            ${q.tags.map((t) => `<span class="mtag">${esc(t)}</span>`).join('')}
          </span>
          <span class="dim">${esc(q.authorName)}</span>
          <span class="dim">👁 ${q.views}</span>
          <span class="dim">${fmtDateTime(q.createdAt)}</span>
        </div>`,
            )
            .join('')
        : '<p class="mtop__desc">조건에 맞는 질문이 없습니다. 첫 질문을 남겨보세요!</p>';

      list.querySelectorAll<HTMLElement>('[data-id]').forEach((row) =>
        row.addEventListener('click', () => void open(row.dataset.id!)),
      );
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function renderDetail(q: QuestionDetail): void {
    const isAsker = q.authorId === me.id;
    detail.hidden = false;
    detail.innerHTML = `
      <div class="mpanel__t">// 질문 상세 <span class="sp"></span>
        ${isAsker || isAdmin ? '<button class="mbtn mbtn--danger" id="dDel" style="padding:4px 10px;font-size:11.5px">삭제</button>' : ''}
        <button class="mbtn" id="dClose" style="padding:4px 10px;font-size:11.5px">닫기</button>
      </div>
      <h2 style="font-size:20px">${q.solved ? '✅ ' : ''}${esc(q.title)}</h2>
      <p class="mtop__desc" style="margin:6px 0 12px">
        ${esc(q.authorName)} · ${fmtDateTime(q.createdAt)} · 조회 ${q.views}
        ${q.tags.length ? ` · ${q.tags.map((t) => `<span class="mtag">${esc(t)}</span>`).join('')}` : ''}
      </p>
      <div style="white-space:pre-wrap;color:var(--muted);font-size:14.5px;line-height:1.75">${esc(q.body)}</div>

      <div class="mpanel__t" style="margin-top:22px">// 답변 ${q.answers.length}</div>
      <div id="aList">
        ${
          q.answers.length
            ? q.answers
                .map(
                  (a) => `
            <div class="answer${a.accepted ? ' accepted' : ''}">
              <div class="answer__head">
                <b>${esc(a.authorName)}</b>
                <span class="dim">${fmtDateTime(a.createdAt)}</span>
                ${a.accepted ? '<span class="mtag" style="border-color:rgba(163,230,53,.45);color:var(--lime)">채택된 답변</span>' : ''}
                <span style="flex:1"></span>
                ${isAsker ? `<button class="mbtn" data-accept="${a.id}" style="padding:3px 10px;font-size:11px">${a.accepted ? '채택 해제' : '채택'}</button>` : ''}
                ${a.authorId === me.id || isAdmin ? `<button class="mbtn mbtn--danger" data-adel="${a.id}" style="padding:3px 10px;font-size:11px">삭제</button>` : ''}
              </div>
              <div style="white-space:pre-wrap;font-size:14px">${esc(a.body)}</div>
            </div>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 답변이 없습니다. 아는 만큼만 답해줘도 큰 도움이 됩니다.</p>'
        }
      </div>
      <form class="mform" id="aForm" style="margin-top:14px">
        <textarea class="mctl" id="aBody" required placeholder="답변을 적어주세요" style="min-height:90px"></textarea>
        <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">답변 등록</button></div>
      </form>`;

    detail.querySelector('#dClose')!.addEventListener('click', () => {
      detail.hidden = true;
    });
    detail.querySelector('#dDel')?.addEventListener('click', () => {
      if (!confirm('이 질문을 삭제할까요? 답변도 함께 사라집니다.')) return;
      void api.member.qna.remove(q.id).then(() => {
        detail.hidden = true;
        toast('삭제했습니다.');
        void load();
      });
    });
    detail.querySelector('#aForm')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = (detail.querySelector('#aBody') as HTMLTextAreaElement).value.trim();
      if (!body) return;
      void api.member.qna.answer(q.id, body).then(() => {
        toast('답변을 등록했습니다.');
        void open(q.id);
        void load();
      });
    });
    detail.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach((b) =>
      b.addEventListener('click', () => {
        void api.member.qna
          .accept(q.id, b.dataset.accept!)
          .then(() => {
            void open(q.id);
            void load();
          })
          .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
      }),
    );
    detail.querySelectorAll<HTMLButtonElement>('[data-adel]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 답변을 삭제할까요?')) return;
        void api.member.qna.removeAnswer(b.dataset.adel!).then(() => {
          void open(q.id);
          void load();
        });
      }),
    );
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function open(id: string): Promise<void> {
    try {
      renderDetail(await api.member.qna.detail(id));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '질문을 불러오지 못했습니다.');
    }
  }

  const form = document.getElementById('qForm') as HTMLFormElement;
  document.getElementById('toggleForm')!.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });
  document.getElementById('qCancel')!.addEventListener('click', () => {
    form.hidden = true;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    void api.member.qna
      .ask({
        title: val('tTitle'),
        body: val('tBody'),
        tags: val('tTags')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      .then(() => {
        toast('질문을 올렸습니다.');
        form.reset();
        form.hidden = true;
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'),
      );
  });

  document.getElementById('fUnsolved')!.addEventListener('change', () => void load());
  for (const id of ['fQ', 'fTag']) {
    document.getElementById(id)!.addEventListener('input', () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void load(), 300);
    });
  }

  await load();
  if (location.hash.length > 1) void open(location.hash.slice(1));
}

void main();
