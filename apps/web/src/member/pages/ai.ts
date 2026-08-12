import type { AiAnswer } from '@sowl/shared';
import { ApiError, api } from '../../lib/api';
import { esc, initMemberPage } from '../layout';

const SAMPLES = [
  '동아리방은 어디에 있고 언제 열려 있나요?',
  '이번 학기 스터디는 뭐가 있어요?',
  '세미나 출석은 어떻게 하나요?',
  '회비는 얼마인가요?',
];

/** #29 S.OWL AI — 동아리 자료 기반 Q&A */
async function main(): Promise<void> {
  const ctx = await initMemberPage('ai');
  if (!ctx) return;
  const { content } = ctx;

  const status = await api.member.ai.status().catch(() => ({ enabled: false }));

  content.innerHTML = `
    <div class="mpanel aihero">
      <div class="aihero__owl">🦉</div>
      <h2>S.OWL AI</h2>
      <p>공지·자료실·Q&A·스터디·세미나·게시글에서 찾아 답합니다. 동아리 자료에 없는 건 답하지 않아요.</p>
      <span class="aimode ${status.enabled ? 'on' : ''}">${
        status.enabled ? '● Claude 답변 켜짐' : '● 검색 전용 (서버에 API 키 없음)'
      }</span>
      <form class="aiform" id="aiForm">
        <input class="mctl" id="aiQ" placeholder="동아리에 대해 궁금한 걸 물어보세요" maxlength="500" required />
        <button class="mbtn mbtn--cy" type="submit" id="aiBtn">물어보기</button>
      </form>
      <div class="aisamples">
        ${SAMPLES.map((s) => `<button class="mbtn" data-sample="${esc(s)}" style="padding:4px 12px;font-size:12px">${esc(s)}</button>`).join('')}
      </div>
    </div>
    <div id="aiOut"></div>`;

  const out = document.getElementById('aiOut')!;

  function renderAnswer(a: AiAnswer): void {
    out.innerHTML = `
      <div class="mpanel">
        <div class="mpanel__t">// 답변
          <span class="sp"></span>
          <span class="mtag">${a.mode === 'claude' ? 'Claude + 동아리 자료' : '자료 검색'}</span>
        </div>
        <p class="aiq">${esc(a.question)}</p>
        <div class="aianswer">${esc(a.answer)}</div>
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 근거 자료 ${a.sources.length}</div>
        ${
          a.sources.length
            ? a.sources
                .map(
                  (s, i) => `
            ${s.href ? `<a class="mrow" href="${s.href}">` : '<div class="mrow" style="cursor:default">'}
              <span class="mono dim">[${i + 1}]</span>
              <span class="mtag">${esc(s.kind)}</span>
              <span class="grow"><b>${esc(s.title)}</b> <span class="dim">${esc(s.snippet.slice(0, 90))}</span></span>
            ${s.href ? '</a>' : '</div>'}`,
                )
                .join('')
            : '<p class="mtop__desc">관련 자료를 찾지 못했습니다.</p>'
        }
      </div>`;
  }

  function ask(question: string): void {
    const btn = document.getElementById('aiBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '찾는 중...';
    out.innerHTML = '<div class="mpanel"><p class="mtop__desc">동아리 자료를 뒤지는 중…</p></div>';
    void api.member.ai
      .ask(question)
      .then(renderAnswer)
      .catch((e: unknown) => {
        out.innerHTML = `<div class="mpanel"><p class="mtop__desc" style="color:var(--danger)">${
          e instanceof ApiError ? esc(e.message) : '답변을 가져오지 못했습니다.'
        }</p></div>`;
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = '물어보기';
      });
  }

  document.getElementById('aiForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (document.getElementById('aiQ') as HTMLInputElement).value.trim();
    if (q) ask(q);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((b) =>
    b.addEventListener('click', () => {
      (document.getElementById('aiQ') as HTMLInputElement).value = b.dataset.sample!;
      ask(b.dataset.sample!);
    }),
  );
}

void main();
