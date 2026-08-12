import { api } from '../../lib/api';
import { esc, fmtDate, fmtDateTime, initMemberPage } from '../layout';

/** #1 대시보드 — 공지·일정·게시글 요약 + 내 상태 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('index');
  if (!ctx) return;
  const { me, content } = ctx;

  content.innerHTML = `
    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v">${me.generation ? `${me.generation}기` : '-'}</div><div class="t">내 기수</div></div>
      <div class="mstat"><div class="v">${me.points}<small style="font-size:13px">pt</small></div><div class="t">동아리 포인트</div></div>
      <div class="mstat"><div class="v" id="dsMembers">-</div><div class="t">활동 부원</div></div>
    </div>
    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 최근 공지 <span class="sp"></span><a class="mbtn" href="/member/notice/notices.html" style="padding:4px 10px;font-size:11.5px">전체</a></div>
        <div id="dsNotices"><p class="mtop__desc">불러오는 중…</p></div>
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 다가오는 일정 <span class="sp"></span><a class="mbtn" href="/member/notice/calendar.html" style="padding:4px 10px;font-size:11.5px">캘린더</a></div>
        <div id="dsEvents"><p class="mtop__desc">불러오는 중…</p></div>
      </div>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 자유게시판 최신 글 <span class="sp"></span><a class="mbtn" href="/member/community/board.html" style="padding:4px 10px;font-size:11.5px">게시판</a></div>
      <div id="dsPosts"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  try {
    const d = await api.member.dashboard();
    const members = document.getElementById('dsMembers');
    if (members) members.textContent = String(d.memberCount);

    const notices = document.getElementById('dsNotices')!;
    notices.innerHTML = d.notices.length
      ? d.notices
          .map(
            (n) => `
        <a class="mrow${n.read ? '' : ' unread'}" href="/member/notice/notices.html#${n.id}">
          ${n.pinned ? '<span class="pin">고정</span>' : ''}
          <span class="grow">${esc(n.title)}</span>
          ${n.read ? '' : '<span class="newdot" aria-label="안 읽음"></span>'}
          <span class="dim">${fmtDate(n.createdAt)}</span>
        </a>`,
          )
          .join('')
      : '<p class="mtop__desc">아직 공지가 없습니다.</p>';

    const events = document.getElementById('dsEvents')!;
    events.innerHTML = d.events.length
      ? d.events
          .map(
            (e) => `
        <div class="mrow" style="cursor:default">
          <span class="grow">${esc(e.title)}</span>
          ${e.location ? `<span class="dim">${esc(e.location)}</span>` : ''}
          <span class="dim">${fmtDateTime(e.startsAt)}</span>
        </div>`,
          )
          .join('')
      : '<p class="mtop__desc">예정된 일정이 없습니다.</p>';

    const posts = document.getElementById('dsPosts')!;
    posts.innerHTML = d.posts.length
      ? d.posts
          .map(
            (p) => `
        <a class="mrow" href="/member/community/board.html#${p.id}">
          <span class="grow">${esc(p.title)}</span>
          <span class="dim">${esc(p.authorName)}</span>
          <span class="dim">♥ ${p.likeCount} · 💬 ${p.commentCount}</span>
          <span class="dim">${fmtDate(p.createdAt)}</span>
        </a>`,
          )
          .join('')
      : '<p class="mtop__desc">아직 글이 없습니다. 첫 글을 남겨보세요!</p>';
  } catch {
    /* 개별 패널은 초기 문구 유지 */
  }
}

void main();
