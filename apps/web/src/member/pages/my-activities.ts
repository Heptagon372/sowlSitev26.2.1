import { PROJECT_STATUS_LABEL, STUDY_STATUS_LABEL } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, fmtDateTime, initMemberPage } from '../layout';

/** #23 내 활동 기록 — 참여 이력·출석·제출물 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('my-activities');
  if (!ctx) return;
  const { me, content } = ctx;

  content.innerHTML = '<p class="mtop__desc">불러오는 중…</p>';

  let a;
  try {
    a = await api.member.activity.mine();
  } catch (e) {
    content.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '활동 기록을 불러오지 못했습니다.'}</p>`;
    toast('활동 기록을 불러오지 못했습니다.');
    return;
  }

  content.innerHTML = `
    <div class="mgrid3" style="margin-bottom:14px">
      <div class="mstat"><div class="v">${a.points}<small style="font-size:13px">pt</small></div><div class="t">내 포인트</div></div>
      <div class="mstat"><div class="v">${a.attendance.rate}%</div><div class="t">세미나 출석률 (${a.attendance.attended}/${a.attendance.totalSeminars})</div></div>
      <div class="mstat"><div class="v">${a.joinedStudies.length}</div><div class="t">참여 스터디</div></div>
    </div>
    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v">${a.submissions.length}</div><div class="t">과제 제출</div></div>
      <div class="mstat"><div class="v">${a.counts.posts + a.counts.comments}</div><div class="t">글 · 댓글</div></div>
      <div class="mstat"><div class="v">${a.counts.questions + a.counts.answers}</div><div class="t">질문 · 답변</div></div>
    </div>

    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 참여 중인 스터디</div>
        ${
          a.joinedStudies.length
            ? a.joinedStudies
                .map(
                  (s) => `<a class="mrow" href="/member/study/studies.html#${s.id}">
                    <span class="statuschip ${s.status.toLowerCase()}">${STUDY_STATUS_LABEL[s.status]}</span>
                    <span class="grow">${esc(s.title)}</span>
                    <span class="dim">${fmtDate(s.joinedAt)} 참여</span></a>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 참여한 스터디가 없습니다.</p>'
        }
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 내 프로젝트</div>
        ${
          a.projects.length
            ? a.projects
                .map(
                  (p) => `<a class="mrow" href="/member/project/projects.html">
                    <span class="statuschip ${p.status.toLowerCase()}">${PROJECT_STATUS_LABEL[p.status]}</span>
                    <span class="grow">${esc(p.name)}</span>
                    <span class="mtag">${esc(p.role)}</span></a>`,
                )
                .join('')
            : '<p class="mtop__desc">참여 중인 프로젝트가 없습니다.</p>'
        }
      </div>
    </div>

    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 과제 제출물</div>
        ${
          a.submissions.length
            ? a.submissions
                .map(
                  (s) => `<div class="mrow" style="cursor:default">
                    <span class="${s.score !== null ? 'mtag' : 'dim'}" style="${
                      s.score !== null ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : ''
                    }">${s.score !== null ? `${s.score}점` : '채점 대기'}</span>
                    <span class="grow">${esc(s.title)}${s.feedback ? `<br /><span class="dim" style="font-size:12px">💬 ${esc(s.feedback)}</span>` : ''}</span>
                    <span class="dim">${fmtDate(s.submittedAt)}</span></div>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 제출한 과제가 없습니다.</p>'
        }
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 세미나 출석</div>
        ${
          a.attendance.recent.length
            ? a.attendance.recent
                .map(
                  (r) => `<div class="mrow" style="cursor:default">
                    <span class="${r.attended ? 'mtag' : 'dim'}" style="${
                      r.attended ? 'border-color:rgba(163,230,53,.4);color:var(--lime)' : ''
                    }">${r.attended ? '출석' : '결석'}</span>
                    <span class="grow">${esc(r.title)}</span>
                    <span class="dim">${fmtDate(r.startsAt)}</span></div>`,
                )
                .join('')
            : '<p class="mtop__desc">지난 세미나가 없습니다.</p>'
        }
      </div>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 내 발자국 <span class="sp"></span>
        <span class="mtop__desc">${me.name}님이 남긴 기록</span></div>
      <div class="timeline">
        ${
          a.timeline.length
            ? a.timeline
                .map(
                  (t) => `
            <a class="tllink" href="${t.href ?? '#'}">
              <div class="tlitem">
                <span class="tlitem__icon" style="--kc:var(--cyan)">•</span>
                <div class="tlitem__body">
                  <div class="tlitem__title">${esc(t.title)}</div>
                  <div class="tlitem__meta">
                    ${t.detail ? `<span class="mtag">${esc(t.detail)}</span>` : ''}
                    <span class="dim">${fmtDateTime(t.at)}</span>
                  </div>
                </div>
              </div>
            </a>`,
                )
                .join('')
            : '<p class="mtop__desc">아직 기록이 없습니다. 게시판·과제·세미나에 참여해 보세요!</p>'
        }
      </div>
    </div>`;
}

void main();
