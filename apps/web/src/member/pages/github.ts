import type { GithubActivity } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

const EVENT_LABEL: Record<string, string> = {
  PushEvent: '푸시',
  PullRequestEvent: 'PR',
  IssuesEvent: '이슈',
  CreateEvent: '생성',
  WatchEvent: '스타',
  ForkEvent: '포크',
  IssueCommentEvent: '댓글',
};

/** #14 GitHub 연동 — 공개 활동만 조회 (30분 캐시) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('github');
  if (!ctx) return;
  const { me, content } = ctx;

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 내 GitHub
        <span class="sp"></span>
        <button class="mbtn" id="refreshBtn">새로고침</button>
        <a class="mbtn" href="/member/people/profile.html">계정 연결/변경</a>
      </div>
      <div id="ghMine"><p class="mtop__desc">불러오는 중…</p></div>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 동아리 GitHub 현황</div>
      <div id="ghClub"></div>
    </div>`;

  function render(a: GithubActivity): string {
    if (!a.linked) {
      return `<p class="mtop__desc">GitHub 계정이 연결되지 않았습니다.
        <a href="/member/people/profile.html" style="color:var(--cyan)">내 프로필</a>에서 GitHub 아이디를 입력하세요.</p>`;
    }
    if (!a.profile) {
      return `<p class="mtop__desc" style="color:var(--danger)">${esc(a.error ?? '조회에 실패했습니다.')}</p>`;
    }
    return `
      ${a.error ? `<p class="mtop__desc" style="color:#fbbf24">${esc(a.error)}</p>` : ''}
      <div class="ghprofile">
        ${a.profile.avatarUrl ? `<img src="${esc(a.profile.avatarUrl)}" alt="" width="56" height="56" />` : ''}
        <div>
          <b>${esc(a.profile.name ?? a.login)}</b>
          <a href="${esc(a.profile.htmlUrl)}" target="_blank" rel="noopener noreferrer" class="dim">@${esc(a.login)} ↗</a>
          ${a.profile.bio ? `<p class="dim" style="font-size:12.5px">${esc(a.profile.bio)}</p>` : ''}
        </div>
        <span class="sp" style="flex:1"></span>
        <div class="ghstats">
          <span><b>${a.profile.publicRepos}</b> repos</span>
          <span><b>${a.profile.followers}</b> followers</span>
        </div>
      </div>

      <div class="mgrid2" style="margin-top:16px">
        <div>
          <div class="mpanel__t">// 최근 저장소</div>
          ${
            a.repos.length
              ? a.repos
                  .map(
                    (r) => `<a class="mrow" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
                      <span class="grow"><b>${esc(r.name)}</b>${r.description ? ` <span class="dim">${esc(r.description)}</span>` : ''}</span>
                      ${r.language ? `<span class="mtag">${esc(r.language)}</span>` : ''}
                      <span class="dim">★ ${r.stars}</span>
                      <span class="dim">${fmtDate(r.pushedAt)}</span></a>`,
                  )
                  .join('')
              : '<p class="mtop__desc">공개 저장소가 없습니다.</p>'
          }
        </div>
        <div>
          <div class="mpanel__t">// 최근 활동</div>
          ${
            a.events.length
              ? a.events
                  .map(
                    (e) => `<div class="mrow" style="cursor:default">
                      <span class="mtag">${esc(EVENT_LABEL[e.type] ?? e.type)}</span>
                      <span class="grow">${esc(e.repo)}</span>
                      ${e.detail ? `<span class="dim">${esc(e.detail)}</span>` : ''}
                      <span class="dim">${fmtDate(e.at)}</span></div>`,
                  )
                  .join('')
              : '<p class="mtop__desc">최근 공개 활동이 없습니다.</p>'
          }
        </div>
      </div>
      ${a.fetchedAt ? `<p class="mtop__desc" style="margin-top:12px">마지막 조회 ${fmtDate(a.fetchedAt)} · 30분 캐시</p>` : ''}`;
  }

  async function loadMine(refresh = false): Promise<void> {
    const box = document.getElementById('ghMine')!;
    try {
      box.innerHTML = render(await api.member.github.mine(refresh));
    } catch (e) {
      box.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '조회에 실패했습니다.'}</p>`;
    }
  }

  async function loadClub(): Promise<void> {
    const box = document.getElementById('ghClub')!;
    try {
      const rows = await api.member.github.club();
      box.innerHTML = rows.length
        ? `<div style="overflow-x:auto"><table class="mtable">
            <thead><tr><th>부원</th><th>GitHub</th><th>공개 저장소</th><th>팔로워</th><th>최근 푸시</th></tr></thead>
            <tbody>${rows
              .map(
                (r) => `<tr>
                <td><b>${esc(r.name)}</b>${r.userId === me.id ? ' <span class="mtag">나</span>' : ''}</td>
                <td><a href="https://github.com/${encodeURIComponent(r.login)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">@${esc(r.login)}</a></td>
                <td class="mono">${r.publicRepos || '-'}</td>
                <td class="mono">${r.followers || '-'}</td>
                <td class="mono" style="font-size:12px">${r.lastPushAt ? fmtDate(r.lastPushAt) : '-'}</td>
              </tr>`,
              )
              .join('')}</tbody></table></div>
            <p class="mtop__desc" style="margin-top:10px">숫자는 각자가 조회했을 때 저장된 캐시입니다 — GitHub API 호출 한도를 아끼려고 여기서는 새로 부르지 않습니다.</p>`
        : '<p class="mtop__desc">GitHub 아이디를 등록한 부원이 아직 없습니다.</p>';
    } catch (e) {
      box.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '조회에 실패했습니다.'}</p>`;
    }
  }

  document.getElementById('refreshBtn')!.addEventListener('click', () => {
    toast('GitHub에서 다시 가져옵니다…');
    void loadMine(true).then(() => void loadClub());
  });

  await loadMine();
  await loadClub();
}

void main();
