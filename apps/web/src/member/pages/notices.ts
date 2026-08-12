import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #2 공지사항 — 목록·상세·읽음 표시·상단 고정 (+ 관리자 작성) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('notices');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    ${
      isAdmin
        ? `<div class="mpanel">
            <div class="mpanel__t">// 공지 작성 (관리자)</div>
            <form class="mform" id="nForm">
              <input class="mctl" id="nTitle" placeholder="제목" maxlength="150" required />
              <textarea class="mctl" id="nBody" placeholder="내용" required></textarea>
              <div style="display:flex;gap:12px;align-items:center">
                <label style="display:flex;align-items:center;gap:7px;margin:0;font-size:12px">
                  <input type="checkbox" id="nPinned" /> 상단 고정
                </label>
                <span style="flex:1"></span>
                <button class="mbtn mbtn--cy" type="submit">등록</button>
              </div>
            </form>
          </div>`
        : ''
    }
    <div class="mpanel">
      <div class="mpanel__t">// 공지 목록</div>
      <div id="nList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>
    <div class="mpanel" id="nDetail" hidden>
      <div class="mpanel__t">// 상세 <span class="sp"></span>
        <button class="mbtn" id="nClose" style="padding:4px 10px;font-size:11.5px">닫기</button>
      </div>
      <h2 id="ndTitle" style="font-size:20px"></h2>
      <p class="mtop__desc" id="ndMeta" style="margin:6px 0 16px"></p>
      <div id="ndBody" style="white-space:pre-wrap;color:var(--muted);font-size:14.5px;line-height:1.75"></div>
      <div id="ndAdmin" style="margin-top:16px"></div>
    </div>`;

  const list = document.getElementById('nList')!;
  const detail = document.getElementById('nDetail')!;

  async function load(): Promise<void> {
    try {
      const notices = await api.member.notices.list();
      list.innerHTML = notices.length
        ? notices
            .map(
              (n) => `
          <div class="mrow${n.read ? '' : ' unread'}" data-id="${n.id}" role="button" tabindex="0">
            ${n.pinned ? '<span class="pin">고정</span>' : ''}
            <span class="grow">${esc(n.title)}</span>
            ${n.read ? '' : '<span class="newdot" aria-label="안 읽음"></span>'}
            <span class="dim">${esc(n.authorName)}</span>
            <span class="dim">${fmtDateTime(n.createdAt)}</span>
          </div>`,
            )
            .join('')
        : '<p class="mtop__desc">아직 공지가 없습니다.</p>';
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  async function open(id: string): Promise<void> {
    try {
      const n = await api.member.notices.detail(id);
      detail.hidden = false;
      document.getElementById('ndTitle')!.textContent = n.title;
      document.getElementById('ndMeta')!.textContent =
        `${n.authorName} · ${fmtDateTime(n.createdAt)}${n.pinned ? ' · 📌 고정' : ''}`;
      document.getElementById('ndBody')!.textContent = n.body;
      const adminBox = document.getElementById('ndAdmin')!;
      adminBox.innerHTML = isAdmin
        ? `<button class="mbtn mbtn--danger" id="ndDelete">공지 삭제</button>`
        : '';
      adminBox.querySelector('#ndDelete')?.addEventListener('click', () => {
        if (!confirm('이 공지를 삭제할까요?')) return;
        void api.member.notices.remove(id).then(() => {
          detail.hidden = true;
          toast('공지를 삭제했습니다.');
          void load();
        });
      });
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      void load(); // 읽음 표시 갱신
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '공지를 불러오지 못했습니다.');
    }
  }

  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (row) void open(row.dataset.id!);
  });
  document.getElementById('nClose')?.addEventListener('click', () => {
    detail.hidden = true;
  });

  document.getElementById('nForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = (document.getElementById('nTitle') as HTMLInputElement).value.trim();
    const body = (document.getElementById('nBody') as HTMLTextAreaElement).value.trim();
    const pinned = (document.getElementById('nPinned') as HTMLInputElement).checked;
    if (!title || !body) return;
    void api.member.notices
      .create({ title, body, pinned })
      .then(() => {
        toast('공지를 등록했습니다.');
        (document.getElementById('nForm') as HTMLFormElement).reset();
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'),
      );
  });

  await load();

  // 대시보드에서 #id 로 진입한 경우 바로 상세 열기
  if (location.hash.length > 1) void open(location.hash.slice(1));
}

void main();
