import { HACKATHON_STATUS_LABEL, type HackathonRow, type HackathonStatus } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #15 해커톤 — 회차 정보 · 팀 편성 · 결과물 제출 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('hackathon');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    ${
      isAdmin
        ? `<div class="mpanel">
            <div class="mpanel__t">// 해커톤 개최 (관리자)</div>
            <form class="mform" id="hForm">
              <div class="mgrid2">
                <div><label for="hRound">회차</label><input class="mctl" id="hRound" type="number" min="1" value="1" required /></div>
                <div><label for="hTitle">제목</label><input class="mctl" id="hTitle" maxlength="100" required placeholder="S.OWL 여름 해커톤" /></div>
              </div>
              <div class="mgrid2">
                <div><label for="hStart">시작</label><input class="mctl" id="hStart" type="datetime-local" required /></div>
                <div><label for="hEnd">종료</label><input class="mctl" id="hEnd" type="datetime-local" required /></div>
              </div>
              <div class="mgrid2">
                <div><label for="hTheme">주제</label><input class="mctl" id="hTheme" maxlength="100" placeholder="캠퍼스 라이프" /></div>
                <div><label for="hLoc">장소</label><input class="mctl" id="hLoc" maxlength="100" placeholder="동아리방" /></div>
              </div>
              <div><label for="hDesc">설명</label><textarea class="mctl" id="hDesc" style="min-height:70px"></textarea></div>
              <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">개최</button></div>
            </form>
          </div>`
        : ''
    }
    <div id="hList"><p class="mtop__desc">불러오는 중…</p></div>`;

  const list = document.getElementById('hList')!;

  function render(rows: HackathonRow[]): void {
    list.innerHTML = rows.length
      ? rows
          .map(
            (h) => `
      <div class="mpanel">
        <div class="mpanel__t">// ${h.round}회차 <span class="sp"></span>
          ${
            isAdmin
              ? `<select class="mctl" data-status="${h.id}" style="max-width:130px;padding:5px 10px">
                   ${(['PLANNED', 'OPEN', 'ONGOING', 'DONE'] as HackathonStatus[])
                     .map((s) => `<option value="${s}"${s === h.status ? ' selected' : ''}>${HACKATHON_STATUS_LABEL[s]}</option>`)
                     .join('')}
                 </select>
                 <button class="mbtn mbtn--danger" data-hdel="${h.id}" style="padding:4px 10px;font-size:11.5px">삭제</button>`
              : `<span class="statuschip ${h.status === 'DONE' ? 'done' : h.status === 'OPEN' ? 'recruiting' : 'ongoing'}">${HACKATHON_STATUS_LABEL[h.status]}</span>`
          }
        </div>
        <h2 style="font-size:20px">${esc(h.title)}</h2>
        <p class="mtop__desc" style="margin:6px 0 12px">
          ${fmtDate(h.startsAt)} ~ ${fmtDate(h.endsAt)}
          ${h.location ? ` · 📍 ${esc(h.location)}` : ''}
          ${h.theme ? ` · 주제: ${esc(h.theme)}` : ''}
        </p>
        ${h.description ? `<div style="white-space:pre-wrap;color:var(--muted);font-size:14px">${esc(h.description)}</div>` : ''}

        <div class="mpanel__t" style="margin-top:18px">// 참가 팀 ${h.teams.length}
          <span class="sp"></span>
          ${
            !h.myTeamId && h.status !== 'DONE'
              ? `<button class="mbtn mbtn--cy" data-newteam="${h.id}" style="padding:4px 12px;font-size:12px">팀 만들기</button>`
              : ''
          }
        </div>
        <div class="cardgrid">
          ${
            h.teams.length
              ? h.teams
                  .map(
                    (t) => `
              <article class="tpcard">
                <div class="scard__top">
                  ${t.rank ? `<span class="statuschip recruiting">${t.rank}위</span>` : ''}
                  ${t.score !== null ? `<span class="mtag">${t.score}점</span>` : ''}
                  <span class="sp"></span>
                  <span class="dim mono" style="font-size:11.5px">${t.members.length}명</span>
                </div>
                <h3>${esc(t.name)}</h3>
                ${t.idea ? `<p>${esc(t.idea)}</p>` : ''}
                <div class="pcard__stack">${t.members.map((m) => `<span class="mtag">${esc(m.name)}</span>`).join('')}</div>
                <div class="scard__foot">
                  ${t.repoUrl ? `<a class="mbtn" href="${esc(t.repoUrl)}" target="_blank" rel="noopener noreferrer" style="padding:3px 10px;font-size:11.5px">저장소 ↗</a>` : ''}
                  ${t.demoUrl ? `<a class="mbtn" href="${esc(t.demoUrl)}" target="_blank" rel="noopener noreferrer" style="padding:3px 10px;font-size:11.5px">데모 ↗</a>` : ''}
                  ${t.submittedAt ? '<span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">제출 완료</span>' : ''}
                  <span class="sp"></span>
                  ${
                    t.joinedByMe
                      ? `<button class="mbtn" data-submit="${t.id}" style="padding:4px 12px;font-size:12px">결과물 제출</button>
                         <button class="mbtn mbtn--danger" data-leave="${t.id}" style="padding:4px 12px;font-size:12px">팀 나가기</button>`
                      : !h.myTeamId && h.status !== 'DONE'
                        ? `<button class="mbtn mbtn--cy" data-join="${t.id}" style="padding:4px 12px;font-size:12px">합류</button>`
                        : ''
                  }
                  ${isAdmin ? `<button class="mbtn" data-score="${t.id}" style="padding:4px 12px;font-size:12px">심사</button>` : ''}
                </div>
              </article>`,
                  )
                  .join('')
              : '<p class="mtop__desc">아직 참가 팀이 없습니다.</p>'
          }
        </div>
      </div>`,
          )
          .join('')
      : '<div class="mpanel"><p class="mtop__desc">아직 열린 해커톤이 없습니다.</p></div>';

    bind();
  }

  function bind(): void {
    const after = (msg: string) => () => {
      toast(msg);
      void load();
    };
    const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.');

    list.querySelectorAll<HTMLButtonElement>('[data-newteam]').forEach((b) =>
      b.addEventListener('click', () => {
        const name = prompt('팀 이름');
        if (!name?.trim()) return;
        const idea = prompt('무엇을 만들 예정인가요? (선택)') ?? undefined;
        void api.member.hackathons
          .createTeam(b.dataset.newteam!, name.trim(), idea?.trim() || undefined)
          .then(after('팀을 만들었습니다.'))
          .catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-join]').forEach((b) =>
      b.addEventListener('click', () =>
        void api.member.hackathons.joinTeam(b.dataset.join!).then(after('팀에 합류했습니다.')).catch(fail),
      ),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-leave]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('팀에서 나갈까요? 마지막 팀원이면 팀이 사라집니다.')) return;
        void api.member.hackathons.leaveTeam(b.dataset.leave!).then(after('팀에서 나왔습니다.')).catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-submit]').forEach((b) =>
      b.addEventListener('click', () => {
        const repoUrl = prompt('저장소 URL (비우면 삭제)') ?? '';
        const demoUrl = prompt('데모 URL (선택)') ?? '';
        void api.member.hackathons
          .submit(b.dataset.submit!, { repoUrl: repoUrl.trim(), demoUrl: demoUrl.trim() })
          .then(after('제출했습니다.'))
          .catch(fail);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-score]').forEach((b) =>
      b.addEventListener('click', () => {
        const score = prompt('점수 (0~100)');
        if (!score?.trim()) return;
        const rank = prompt('순위 (선택)');
        void api.member.hackathons
          .score(b.dataset.score!, Number(score), rank?.trim() ? Number(rank) : undefined)
          .then(after('심사 결과를 저장했습니다.'))
          .catch(fail);
      }),
    );
    list.querySelectorAll<HTMLSelectElement>('[data-status]').forEach((s) =>
      s.addEventListener('change', () =>
        void api.member.hackathons
          .setStatus(s.dataset.status!, s.value as HackathonStatus)
          .then(after('상태를 변경했습니다.'))
          .catch(fail),
      ),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-hdel]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('이 해커톤을 삭제할까요? 참가 팀도 함께 사라집니다.')) return;
        void api.member.hackathons.remove(b.dataset.hdel!).then(after('삭제했습니다.')).catch(fail);
      }),
    );
  }

  async function load(): Promise<void> {
    try {
      render(await api.member.hackathons.list());
    } catch (e) {
      list.innerHTML = `<div class="mpanel"><p class="mtop__desc">${
        e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다.'
      }</p></div>`;
    }
  }

  document.getElementById('hForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    void api.member.hackathons
      .create({
        round: Number(val('hRound')),
        title: val('hTitle'),
        theme: val('hTheme') || undefined,
        description: val('hDesc') || undefined,
        location: val('hLoc') || undefined,
        startsAt: new Date(val('hStart')).toISOString(),
        endsAt: new Date(val('hEnd')).toISOString(),
        status: 'OPEN',
      })
      .then(() => {
        toast('해커톤을 열었습니다.');
        (document.getElementById('hForm') as HTMLFormElement).reset();
        void load();
      })
      .catch((err: unknown) => toast(err instanceof ApiError ? err.message : '개최에 실패했습니다.'));
  });

  await load();
}

void main();
