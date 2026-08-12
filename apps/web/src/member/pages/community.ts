import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #17 커뮤니티 허브 — 게시판·Q&A·설문·채팅 최신을 한 화면에 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('community');
  if (!ctx) return;
  const { content } = ctx;

  content.innerHTML = '<p class="mtop__desc">불러오는 중…</p>';

  let hub;
  try {
    hub = await api.member.communityHub();
  } catch (e) {
    content.innerHTML = `<p class="mtop__desc">${
      e instanceof ApiError ? esc(e.message) : '커뮤니티를 불러오지 못했습니다.'
    }</p>`;
    return;
  }

  content.innerHTML = `
    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v">${hub.counts.posts}</div><div class="t">게시글</div></div>
      <div class="mstat"><div class="v">${hub.counts.questions}<small style="font-size:13px">건</small></div>
        <div class="t">질문 (미해결 ${hub.counts.unsolved})</div></div>
      <div class="mstat"><div class="v">${hub.counts.polls}</div><div class="t">설문</div></div>
    </div>

    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 자유게시판 <span class="sp"></span>
          <a class="mbtn" href="/member/community/board.html" style="padding:4px 10px;font-size:11.5px">전체</a></div>
        ${
          hub.posts.length
            ? hub.posts
                .map(
                  (p) => `<a class="mrow" href="/member/community/board.html#${p.id}">
                    <span class="grow">${esc(p.title)}</span>
                    <span class="dim">${esc(p.authorName)}</span>
                    <span class="dim">♥ ${p.likeCount} · 💬 ${p.commentCount}</span></a>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 글이 없습니다.</p>'
        }
      </div>

      <div class="mpanel">
        <div class="mpanel__t">// 질문 / Q&A <span class="sp"></span>
          <a class="mbtn" href="/member/community/qna.html" style="padding:4px 10px;font-size:11.5px">전체</a></div>
        ${
          hub.questions.length
            ? hub.questions
                .map(
                  (q) => `<a class="mrow" href="/member/community/qna.html#${q.id}">
                    <span class="answerchip${q.solved ? ' solved' : ''}"><b>${q.answerCount}</b><span>답변</span></span>
                    <span class="grow">${q.solved ? '✅ ' : ''}${esc(q.title)}</span>
                    <span class="dim">${esc(q.authorName)}</span></a>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 질문이 없습니다.</p>'
        }
      </div>
    </div>

    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 진행 중인 설문 <span class="sp"></span>
          <a class="mbtn" href="/member/community/polls.html" style="padding:4px 10px;font-size:11.5px">전체</a></div>
        ${
          hub.polls.length
            ? hub.polls
                .map(
                  (p) => `<a class="mrow" href="/member/community/polls.html">
                    <span class="statuschip ${p.closed ? 'done' : 'recruiting'}">${p.closed ? '마감' : '진행'}</span>
                    <span class="grow">${esc(p.title)}</span>
                    <span class="dim">${p.totalVoters}명 응답</span></a>`,
                )
                .join('')
            : '<p class="mtop__desc">진행 중인 설문이 없습니다.</p>'
        }
      </div>

      <div class="mpanel">
        <div class="mpanel__t">// 채팅 최근 대화 <span class="sp"></span>
          <a class="mbtn" href="/member/community/chat.html" style="padding:4px 10px;font-size:11.5px">채팅방</a></div>
        ${
          hub.latestChat.length
            ? hub.latestChat
                .map(
                  (c) => `<a class="mrow" href="/member/community/chat.html?room=${encodeURIComponent(c.roomSlug)}">
                    <span class="mtag">${esc(c.room)}</span>
                    <span class="grow"><b>${esc(c.userName)}</b> ${esc(c.body)}</span>
                    <span class="dim">${fmtDateTime(c.at)}</span></a>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 대화가 없습니다.</p>'
        }
      </div>
    </div>`;
}

void main();
