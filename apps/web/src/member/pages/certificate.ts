import type { CertificateData } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/**
 * #25 수료 / 활동 인증 — 확인서 미리보기·발급·인쇄
 * PDF는 브라우저 인쇄(‘PDF로 저장’)로 만든다. 서버에서 만들려면 한글 폰트를
 * 번들해야 하는데, 인쇄 경로가 서식도 그대로 나오고 훨씬 가볍다.
 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('certificate');
  if (!ctx) return;
  const { content } = ctx;

  function render(c: CertificateData, issued: boolean): string {
    return `
    <div class="cert" id="certSheet">
      <div class="cert__head">
        <img src="/img/soul_logo.png" alt="" width="56" height="56" />
        <div>
          <div class="cert__club">SLEEPY OWL · 성공회대학교 IT 동아리</div>
          <h1>활동 확인서</h1>
        </div>
      </div>

      <table class="cert__meta">
        <tr><th>성명</th><td>${esc(c.name)}</td><th>학번</th><td class="mono">${esc(c.studentId)}</td></tr>
        <tr><th>기수</th><td>${c.generation ? `${c.generation}기` : '-'}</td><th>가입일</th><td>${fmtDate(c.joinedAt)}</td></tr>
      </table>

      <div class="cert__body">
        <p>위 사람은 SLEEPY OWL의 부원으로서 아래와 같이 활동하였음을 확인합니다.</p>
        <ul class="cert__list">
          ${c.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}
        </ul>
        <div class="cert__stats">
          <span>스터디 ${c.stats.studies}</span>
          <span>세미나 출석 ${c.stats.seminarsAttended}회 (${c.stats.seminarRate}%)</span>
          <span>과제 ${c.stats.missions}</span>
          <span>프로젝트 ${c.stats.projects}</span>
          <span>포인트 ${c.stats.points}pt</span>
        </div>
      </div>

      <div class="cert__foot">
        <div>
          <div class="cert__code mono">확인번호 ${esc(c.code)}</div>
          <div class="dim">발급일 ${fmtDate(c.issuedAt)}</div>
        </div>
        <div class="cert__sign">
          <b>SLEEPY OWL</b>
          <span class="dim">성공회대학교 IT 동아리</span>
        </div>
      </div>
      ${issued ? '' : '<div class="cert__draft">미발급 미리보기</div>'}
    </div>`;
  }

  async function load(): Promise<void> {
    let preview: CertificateData;
    let issuedList: Array<{ code: string; issuedAt: string }> = [];
    try {
      [preview, issuedList] = await Promise.all([
        api.member.certificate.preview(),
        api.member.certificate.mine().catch(() => []),
      ]);
    } catch (e) {
      content.innerHTML = `<p class="mtop__desc">${
        e instanceof ApiError ? esc(e.message) : '확인서를 불러오지 못했습니다.'
      }</p>`;
      return;
    }

    content.innerHTML = `
      <div class="mpanel noprint">
        <div class="mpanel__t">// 활동 확인서
          <span class="sp"></span>
          <button class="mbtn mbtn--cy" id="issueBtn">발급하기</button>
          <button class="mbtn" id="printBtn">인쇄 / PDF 저장</button>
        </div>
        <p class="mtop__desc">발급하면 그 시점의 활동이 확인번호와 함께 굳어집니다. 인쇄 창에서 '대상: PDF로 저장'을 고르면 파일로 받을 수 있어요.</p>
        ${
          issuedList.length
            ? `<div style="margin-top:12px">${issuedList
                .map(
                  (i) =>
                    `<div class="mrow" style="cursor:default"><span class="mono grow">${esc(i.code)}</span>
                     <span class="dim">${fmtDate(i.issuedAt)} 발급</span></div>`,
                )
                .join('')}</div>`
            : ''
        }
      </div>
      <div id="certHost">${render(preview, false)}</div>
      <div class="mpanel noprint">
        <div class="mpanel__t">// 확인번호 조회</div>
        <form class="mform" id="verifyForm" style="flex-direction:row;gap:8px">
          <input class="mctl" id="vCode" placeholder="SOWL-2026-XXXXXX" style="flex:1" />
          <button class="mbtn" type="submit">조회</button>
        </form>
        <div id="verifyOut"></div>
      </div>`;

    document.getElementById('issueBtn')!.addEventListener('click', () => {
      if (!confirm('지금 활동 내역으로 확인서를 발급할까요?')) return;
      void api.member.certificate
        .issue()
        .then((c) => {
          toast(`발급 완료 · ${c.code}`);
          document.getElementById('certHost')!.innerHTML = render(c, true);
          void load();
        })
        .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '발급에 실패했습니다.'));
    });

    document.getElementById('printBtn')!.addEventListener('click', () => window.print());

    document.getElementById('verifyForm')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = (document.getElementById('vCode') as HTMLInputElement).value.trim();
      if (!code) return;
      void api.member.certificate
        .verify(code)
        .then((c) => {
          document.getElementById('verifyOut')!.innerHTML = `
            <div class="mrow" style="cursor:default;margin-top:10px">
              <span class="mtag" style="border-color:rgba(163,230,53,.4);color:var(--lime)">유효</span>
              <span class="grow">${esc(c.name)} (${esc(c.studentId)})${c.generation ? ` · ${c.generation}기` : ''}</span>
              <span class="dim">${fmtDate(c.issuedAt)} 발급</span>
            </div>`;
        })
        .catch((err: unknown) => {
          document.getElementById('verifyOut')!.innerHTML = `<p class="mtop__desc" style="color:var(--danger);margin-top:10px">${
            err instanceof ApiError ? esc(err.message) : '조회에 실패했습니다.'
          }</p>`;
        });
    });
  }

  await load();
}

void main();
