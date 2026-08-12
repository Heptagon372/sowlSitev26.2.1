import type { PostDetail } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #18 자유게시판 — 글 작성·댓글·좋아요 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('board');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';
  let page = 1;

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 새 글 쓰기</div>
      <form class="mform" id="wForm">
        <input class="mctl" id="wTitle" placeholder="제목" maxlength="150" required />
        <textarea class="mctl" id="wBody" placeholder="자유롭게 적어보세요" required></textarea>
        <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">게시</button></div>
      </form>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 게시글 <span id="bTotal" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <button class="mbtn" id="bPrev" style="padding:4px 12px">←</button>
        <button class="mbtn" id="bNext" style="padding:4px 12px">→</button>
      </div>
      <div id="bList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>
    <div class="mpanel" id="bDetail" hidden></div>`;

  const list = document.getElementById('bList')!;
  const detail = document.getElementById('bDetail')!;

  async function load(): Promise<void> {
    try {
      const data = await api.member.posts.list(page);
      document.getElementById('bTotal')!.textContent = `· ${data.total}건 · ${page}페이지`;
      list.innerHTML = data.items.length
        ? data.items
            .map(
              (p) => `
          <div class="mrow" data-id="${p.id}" role="button" tabindex="0">
            <span class="grow">${esc(p.title)}</span>
            <span class="dim">${esc(p.authorName)}</span>
            <span class="dim">♥ ${p.likeCount}</span>
            <span class="dim">💬 ${p.commentCount}</span>
            <span class="dim">${fmtDateTime(p.createdAt)}</span>
          </div>`,
            )
            .join('')
        : '<p class="mtop__desc">아직 글이 없습니다. 첫 글을 남겨보세요!</p>';
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  function renderDetail(p: PostDetail): void {
    detail.hidden = false;
    detail.innerHTML = `
      <div class="mpanel__t">// 글 상세 <span class="sp"></span>
        <button class="mbtn" id="dClose" style="padding:4px 10px;font-size:11.5px">닫기</button>
      </div>
      <h2 style="font-size:20px">${esc(p.title)}</h2>
      <p class="mtop__desc" style="margin:6px 0 16px">${esc(p.authorName)} · ${fmtDateTime(p.createdAt)}</p>
      <div style="white-space:pre-wrap;color:var(--muted);font-size:14.5px;line-height:1.75">${esc(p.body)}</div>
      <div style="display:flex;gap:10px;margin:18px 0">
        <button class="mbtn${p.likedByMe ? ' mbtn--cy' : ''}" id="dLike">♥ 좋아요 <span id="dLikeN">${p.likeCount}</span></button>
        ${p.authorId === me.id || isAdmin ? '<button class="mbtn mbtn--danger" id="dDelete">삭제</button>' : ''}
      </div>
      <div class="mpanel__t" style="margin-top:8px">// 댓글 ${p.comments.length}</div>
      <div id="dComments">
        ${p.comments
          .map(
            (c) => `
          <div class="mcomment">
            <b>${esc(c.authorName)}</b>
            <span class="body">${esc(c.body)}</span>
            ${c.authorId === me.id || isAdmin ? `<button class="mbtn" data-cdel="${c.id}" style="padding:2px 9px;font-size:11px">삭제</button>` : ''}
          </div>`,
          )
          .join('')}
      </div>
      <form class="mform" id="cForm" style="margin-top:14px;flex-direction:row;gap:10px">
        <input class="mctl" id="cBody" placeholder="댓글 달기" maxlength="2000" required style="flex:1" />
        <button class="mbtn mbtn--cy" type="submit">등록</button>
      </form>`;

    detail.querySelector('#dClose')!.addEventListener('click', () => {
      detail.hidden = true;
    });
    detail.querySelector('#dLike')!.addEventListener('click', () => {
      void api.member.posts.like(p.id).then((r) => {
        detail.querySelector('#dLikeN')!.textContent = String(r.likeCount);
        detail.querySelector('#dLike')!.classList.toggle('mbtn--cy', r.liked);
        void load();
      });
    });
    detail.querySelector('#dDelete')?.addEventListener('click', () => {
      if (!confirm('이 글을 삭제할까요?')) return;
      void api.member.posts.remove(p.id).then(() => {
        detail.hidden = true;
        toast('글을 삭제했습니다.');
        void load();
      });
    });
    detail.querySelectorAll<HTMLButtonElement>('[data-cdel]').forEach((b) =>
      b.addEventListener('click', () => {
        void api.member.posts.removeComment(b.dataset.cdel!).then(() => void open(p.id));
      }),
    );
    detail.querySelector('#cForm')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = (detail.querySelector('#cBody') as HTMLInputElement).value.trim();
      if (!body) return;
      void api.member.posts
        .comment(p.id, body)
        .then(() => void open(p.id))
        .then(() => void load());
    });
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function open(id: string): Promise<void> {
    try {
      renderDetail(await api.member.posts.detail(id));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '글을 불러오지 못했습니다.');
    }
  }

  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (row) void open(row.dataset.id!);
  });

  document.getElementById('wForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = (document.getElementById('wTitle') as HTMLInputElement).value.trim();
    const body = (document.getElementById('wBody') as HTMLTextAreaElement).value.trim();
    if (!title || !body) return;
    void api.member.posts
      .create(title, body)
      .then(() => {
        toast('글을 게시했습니다.');
        (document.getElementById('wForm') as HTMLFormElement).reset();
        page = 1;
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '게시에 실패했습니다.'),
      );
  });

  document.getElementById('bPrev')!.addEventListener('click', () => {
    if (page > 1) {
      page -= 1;
      void load();
    }
  });
  document.getElementById('bNext')!.addEventListener('click', () => {
    page += 1;
    void load();
  });

  await load();
  if (location.hash.length > 1) void open(location.hash.slice(1));
}

void main();
