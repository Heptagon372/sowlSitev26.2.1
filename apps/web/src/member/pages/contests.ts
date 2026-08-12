import type { ContestRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #30 공모전 확인 — RSS 피드 수집 + 관리자 수동 등록 + 북마크 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('contests');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';
  let debounce: number | undefined;

  content.innerHTML = `
    ${
      isAdmin
        ? `<div class="mpanel">
            <div class="mpanel__t">// 수집 소스 (관리자)
              <span class="sp"></span>
              <button class="mbtn mbtn--cy" id="refreshBtn">지금 수집</button>
            </div>
            <p class="mtop__desc" style="margin-bottom:12px">
              사이트를 임의로 긁지 않고, 각 사이트가 공개한 <b>RSS/Atom 피드</b>만 읽습니다.
              대상 사이트가 확정되면 전용 수집기를 붙이면 됩니다.
            </p>
            <form class="mform" id="feedForm" style="flex-direction:row;gap:8px;flex-wrap:wrap">
              <input class="mctl" id="fName" placeholder="소스 이름" maxlength="60" required style="max-width:180px" />
              <input class="mctl" id="fUrl" placeholder="https://example.com/rss" required style="flex:1;min-width:220px" />
              <button class="mbtn" type="submit">피드 추가</button>
            </form>
            <div id="feedList" style="margin-top:12px"></div>
          </div>
          <div class="mpanel">
            <div class="mpanel__t">// 직접 등록 (관리자)</div>
            <form class="mform" id="cForm" style="flex-direction:row;gap:8px;flex-wrap:wrap">
              <input class="mctl" id="cTitle" placeholder="공모전 이름" maxlength="200" required style="flex:1;min-width:180px" />
              <input class="mctl" id="cUrl" placeholder="링크" required style="flex:1;min-width:180px" />
              <input class="mctl" id="cHost" placeholder="주최" maxlength="100" style="max-width:140px" />
              <input class="mctl" id="cDeadline" type="date" style="max-width:150px" />
              <button class="mbtn mbtn--cy" type="submit">등록</button>
            </form>
          </div>`
        : ''
    }
    <div class="mpanel">
      <div class="mpanel__t">// 공모전 <span id="cCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--muted)">
          <input type="checkbox" id="fOpen" checked /> 마감 전만
        </label>
        <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--muted)">
          <input type="checkbox" id="fBookmarked" /> 북마크만
        </label>
        <input class="mctl" id="fQ" placeholder="검색" style="max-width:160px;padding:6px 10px" />
      </div>
      <div class="cardgrid" id="cList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('cList')!;

  function card(c: ContestRow): string {
    const urgent = c.dday !== null && c.dday <= 7 && c.dday >= 0;
    return `
    <article class="tpcard">
      <div class="scard__top">
        ${
          c.dday === null
            ? '<span class="statuschip">마감일 미상</span>'
            : c.dday < 0
              ? '<span class="statuschip done">마감</span>'
              : `<span class="statuschip ${urgent ? 'recruiting' : 'ongoing'}">D-${c.dday}</span>`
        }
        ${c.category ? `<span class="mtag">${esc(c.category)}</span>` : ''}
        <span class="sp"></span>
        <button class="bookmark${c.bookmarked ? ' on' : ''}" data-bm="${c.id}" aria-label="북마크">${c.bookmarked ? '★' : '☆'}</button>
      </div>
      <h3><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.title)} ↗</a></h3>
      ${c.summary ? `<p>${esc(c.summary.slice(0, 160))}</p>` : ''}
      <div class="scard__foot">
        ${c.host ? `<span class="dim">🏢 ${esc(c.host)}</span>` : ''}
        ${c.prize ? `<span class="dim">🏆 ${esc(c.prize)}</span>` : ''}
        ${c.deadline ? `<span class="dim">~ ${fmtDate(c.deadline)}</span>` : ''}
        <span class="sp"></span>
        <span class="dim mono" style="font-size:11px">${c.source === 'FEED' ? 'RSS' : '직접 등록'}</span>
        ${isAdmin ? `<button class="mbtn mbtn--danger" data-del="${c.id}" style="padding:3px 10px;font-size:11px">삭제</button>` : ''}
      </div>
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.contests.list({
        q: (document.getElementById('fQ') as HTMLInputElement).value.trim() || undefined,
        open: (document.getElementById('fOpen') as HTMLInputElement).checked,
        bookmarked: (document.getElementById('fBookmarked') as HTMLInputElement).checked,
      });
      document.getElementById('cCount')!.textContent = `· ${rows.length}건`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">등록된 공모전이 없습니다. 관리자가 RSS 피드를 추가하거나 직접 등록할 수 있습니다.</p>';

      list.querySelectorAll<HTMLButtonElement>('[data-bm]').forEach((b) =>
        b.addEventListener('click', () => {
          void api.member.contests.bookmark(b.dataset.bm!).then((r) => {
            b.classList.toggle('on', r.bookmarked);
            b.textContent = r.bookmarked ? '★' : '☆';
          });
        }),
      );
      list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!confirm('이 공모전을 목록에서 지울까요?')) return;
          void api.member.contests.remove(b.dataset.del!).then(() => void load());
        }),
      );
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'}</p>`;
    }
  }

  async function loadFeeds(): Promise<void> {
    const box = document.getElementById('feedList');
    if (!box) return;
    const feeds = await api.member.contests.feeds().catch(() => []);
    box.innerHTML = feeds.length
      ? feeds
          .map(
            (f) => `<div class="mrow" style="cursor:default">
              <span class="grow"><b>${esc(f.name)}</b> <span class="dim mono" style="font-size:11.5px">${esc(f.url)}</span></span>
              ${f.lastError ? `<span class="dim" style="color:var(--danger)">${esc(f.lastError.slice(0, 40))}</span>` : ''}
              <span class="dim">${f.lastFetchedAt ? fmtDate(f.lastFetchedAt) : '수집 전'}</span>
              <button class="mbtn mbtn--danger" data-feeddel="${f.id}" style="padding:3px 10px;font-size:11px">삭제</button>
            </div>`,
          )
          .join('')
      : '<p class="mtop__desc">등록된 피드가 없습니다.</p>';

    box.querySelectorAll<HTMLButtonElement>('[data-feeddel]').forEach((b) =>
      b.addEventListener('click', () => {
        void api.member.contests.removeFeed(b.dataset.feeddel!).then(() => void loadFeeds());
      }),
    );
  }

  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('refreshBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '수집 중...';
    void api.member.contests
      .refresh()
      .then((r) => {
        toast(
          `${r.feeds}개 피드에서 새 공모전 ${r.added}건 추가${r.errors.length ? ` · 실패 ${r.errors.length}건` : ''}`,
        );
        void load();
        void loadFeeds();
      })
      .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '수집에 실패했습니다.'))
      .finally(() => {
        btn.disabled = false;
        btn.textContent = '지금 수집';
      });
  });

  document.getElementById('feedForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (document.getElementById('fName') as HTMLInputElement).value.trim();
    const url = (document.getElementById('fUrl') as HTMLInputElement).value.trim();
    if (!name || !url) return;
    void api.member.contests
      .addFeed(name, url)
      .then(() => {
        toast('피드를 추가했습니다. "지금 수집"을 눌러보세요.');
        (document.getElementById('feedForm') as HTMLFormElement).reset();
        void loadFeeds();
      })
      .catch((err: unknown) => toast(err instanceof ApiError ? err.message : '추가에 실패했습니다.'));
  });

  document.getElementById('cForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
    void api.member.contests
      .add({
        title: val('cTitle'),
        url: val('cUrl'),
        host: val('cHost') || undefined,
        deadline: val('cDeadline') ? new Date(val('cDeadline')).toISOString() : undefined,
      })
      .then(() => {
        toast('등록했습니다.');
        (document.getElementById('cForm') as HTMLFormElement).reset();
        void load();
      })
      .catch((err: unknown) => toast(err instanceof ApiError ? err.message : '등록에 실패했습니다.'));
  });

  for (const id of ['fOpen', 'fBookmarked']) {
    document.getElementById(id)!.addEventListener('change', () => void load());
  }
  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 300);
  });

  await load();
  await loadFeeds();
}

void main();
