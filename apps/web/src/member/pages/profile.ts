import { checkPassword } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, initMemberPage } from '../layout';

/** #27 내 프로필 — 프로필·기술스택·비밀번호 변경 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('profile');
  if (!ctx) return;
  const { me, content } = ctx;

  content.innerHTML = `
    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 프로필</div>
        <form class="mform" id="pForm">
          <div class="mgrid2">
            <div><label for="pName">이름</label><input class="mctl" id="pName" value="${esc(me.name)}" maxlength="10" /></div>
            <div><label>학번 (변경 불가)</label><input class="mctl" value="${esc(me.studentId)}" disabled /></div>
          </div>
          <div class="mgrid2">
            <div><label for="pEmail">이메일</label><input class="mctl" id="pEmail" type="email" value="${esc(me.email ?? '')}" placeholder="owl@skhu.ac.kr" /></div>
            <div><label for="pDept">학과 / 전공</label><input class="mctl" id="pDept" value="${esc(me.department ?? '')}" placeholder="컴퓨터공학과" maxlength="50" /></div>
          </div>
          <div><label for="pGithub">GitHub 아이디</label><input class="mctl" id="pGithub" value="${esc(me.githubLogin ?? '')}" placeholder="octocat" maxlength="50" /></div>
          <div><label for="pStack">기술 스택 <span style="color:var(--dim);letter-spacing:0">(쉼표로 구분)</span></label>
            <input class="mctl" id="pStack" value="${esc(me.techStack.join(', '))}" placeholder="TypeScript, React, NestJS" /></div>
          <div><label for="pBio">소개</label><textarea class="mctl" id="pBio" maxlength="500" placeholder="한 줄 소개">${esc(me.bio ?? '')}</textarea></div>
          <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">저장</button></div>
        </form>
      </div>
      <div>
        <div class="mpanel">
          <div class="mpanel__t">// 내 상태</div>
          <div class="mrow" style="cursor:default"><span class="grow">등급</span>
            <span class="rolebadge ${me.role === 'ADMIN' ? 'rolebadge--admin' : 'rolebadge--member'}">${me.role === 'ADMIN' ? '관리자' : '회원'}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow">기수</span><span class="dim">${me.generation ? `${me.generation}기` : '미지정'}</span></div>
          <div class="mrow" style="cursor:default"><span class="grow">포인트</span><span class="dim">${me.points}pt</span></div>
          <div class="mrow" style="cursor:default;border-bottom:0"><span class="grow">가입일</span><span class="dim">${new Date(me.createdAt).toLocaleDateString('ko-KR')}</span></div>
        </div>
        <div class="mpanel">
          <div class="mpanel__t">// 비밀번호 변경</div>
          <form class="mform" id="pwForm">
            <div><label for="pwCur">현재 비밀번호</label><input class="mctl" id="pwCur" type="password" autocomplete="current-password" required /></div>
            <div><label for="pwNew">새 비밀번호 <span style="color:var(--dim);letter-spacing:0">(8자 이상 + 특수문자)</span></label>
              <input class="mctl" id="pwNew" type="password" autocomplete="new-password" required /></div>
            <div><label for="pwNew2">새 비밀번호 확인</label><input class="mctl" id="pwNew2" type="password" autocomplete="new-password" required /></div>
            <div style="display:flex;justify-content:flex-end"><button class="mbtn" type="submit">변경</button></div>
          </form>
        </div>
      </div>
    </div>`;

  document.getElementById('pForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;
    void api.member.profile
      .update({
        name: val('pName').trim(),
        email: val('pEmail').trim() || null,
        department: val('pDept').trim() || null,
        githubLogin: val('pGithub').trim() || null,
        techStack: val('pStack')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        bio: val('pBio').trim() || null,
      })
      .then(() => toast('프로필을 저장했습니다.'))
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '저장에 실패했습니다.'),
      );
  });

  document.getElementById('pwForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const cur = (document.getElementById('pwCur') as HTMLInputElement).value;
    const next = (document.getElementById('pwNew') as HTMLInputElement).value;
    const next2 = (document.getElementById('pwNew2') as HTMLInputElement).value;
    if (!checkPassword(next).ok) {
      toast('새 비밀번호는 8자 이상 + 특수문자 1자 이상이어야 합니다.');
      return;
    }
    if (next !== next2) {
      toast('새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    void api.member.profile
      .password(cur, next)
      .then(() => {
        toast('비밀번호를 변경했습니다.');
        (document.getElementById('pwForm') as HTMLFormElement).reset();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '변경에 실패했습니다.'),
      );
  });
}

void main();
