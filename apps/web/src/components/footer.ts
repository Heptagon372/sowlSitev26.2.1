import { SITE } from '../config';
import { api } from '../lib/api';

/** 공통 푸터 주입 — 모집 기간은 /api/recruit에서 채우고, 실패 시 '-' */
export function mountFooter(): void {
  const host = document.getElementById('footer');
  if (!host) return;

  host.innerHTML = `
  <footer class="foot">
    <div class="wrap">
      <div class="foot__top">
        <div>
          <div class="foot__brand">
            <img src="/img/soul_logo.png" alt="S.OWL 로고" width="44" height="44" />
            <h2>SOWL</h2>
          </div>
          <p>${SITE.school} IT 개발 동아리.<br />우리는 기술로 세상을 바꾸고,<br />밤을 새워 코딩하는 즐거움을 공유합니다.</p>
          <div class="socials">
            <a class="gh" href="${SITE.github}" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3"/></svg>
            </a>
            <a class="ml" href="mailto:${SITE.email}" aria-label="이메일">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/></svg>
            </a>
            <a class="ig" href="${SITE.instagram}" target="_blank" rel="noopener noreferrer" aria-label="인스타그램">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/></svg>
            </a>
          </div>
        </div>
        <div>
          <h4>// 지원 안내</h4>
          <ul class="foot__list">
            <li>지원 기간: <b id="ftPeriod">-</b></li>
            <li>지원 방법: <b>웹 지원서 / 구글폼</b></li>
            <li>지원 자격: <b>열정 있는 부엉이!</b></li>
            <li>선발 결과: <b>마감 후 1주 이내 개별 연락</b></li>
          </ul>
        </div>
        <div>
          <h4>// 정보</h4>
          <ul class="foot__list">
            <li>소속: <b>${SITE.school} IT 동아리</b></li>
            <li>동아리방: <b id="ftRoom">${SITE.room}</b></li>
            <li>회장: <b>${SITE.president}</b> / 부회장: <b>${SITE.vicePresident}</b></li>
            <li>문의: <a href="mailto:${SITE.email}"><b>${SITE.email}</b></a></li>
          </ul>
        </div>
      </div>
      <div class="foot__bot">
        <p id="ftCopy">© ${new Date().getFullYear()} SLEEPY OWL</p>
        <div style="display:flex;gap:26px;flex-wrap:wrap">
          <span>동아리 이름: SLEEPY OWL</span>
          <span>위치: ${SITE.school} 나눔관</span>
          <span class="cy">S.OWL</span>
        </div>
      </div>
    </div>
  </footer>`;

  // 모집 기간·기수는 API에서 (실패해도 페이지는 유지)
  api
    .recruit()
    .then((info) => {
      const period = host.querySelector('#ftPeriod');
      if (period) period.textContent = info.periodText;
      const copy = host.querySelector('#ftCopy');
      if (copy) {
        const year = new Date(info.endsAt).getFullYear();
        copy.textContent =
          info.phase === 'open'
            ? `© ${year} 소울 ${info.generation}기 모집 중 (Zzz...)`
            : `© ${year} SLEEPY OWL ${info.generation}기`;
      }
    })
    .catch(() => {
      /* 서버 다운 — 기본 문구 유지 */
    });
}
