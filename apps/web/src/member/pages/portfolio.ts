import { PROJECT_STATUS_LABEL, type PortfolioItem } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, initMemberPage } from '../layout';

/** #16 포트폴리오 — 완성작 갤러리 (외부 공개 옵션) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('portfolio');
  if (!ctx) return;
  const { content } = ctx;
  let onlyPublic = false;

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 갤러리 <span id="pfCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--muted)">
          <input type="checkbox" id="fPublic" /> 외부 공개만
        </label>
      </div>
      <p class="mtop__desc">'외부 공개'로 켠 프로젝트는 나중에 공개 사이트에도 실을 수 있습니다.</p>
    </div>
    <div class="cardgrid" id="pfList"><p class="mtop__desc">불러오는 중…</p></div>`;

  const list = document.getElementById('pfList')!;

  function card(p: PortfolioItem): string {
    return `
    <article class="pfcard">
      <div class="pfcard__thumb">
        ${
          p.thumbnailUrl
            ? `<img src="${esc(p.thumbnailUrl)}" alt="" loading="lazy" />`
            : `<span class="pfcard__initial">${esc(p.name.slice(0, 2))}</span>`
        }
        ${p.isPublic ? '<span class="pfcard__public">공개</span>' : ''}
      </div>
      <div class="pfcard__body">
        <div class="scard__top">
          <span class="statuschip ${p.status.toLowerCase()}">${PROJECT_STATUS_LABEL[p.status]}</span>
          ${p.generation ? `<span class="mtag">${p.generation}기</span>` : ''}
          <span class="sp"></span>
          ${p.endedAt ? `<span class="dim mono" style="font-size:11px">${fmtDate(p.endedAt)}</span>` : ''}
        </div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.summary)}</p>
        <div class="pcard__stack">${p.techStack.map((t) => `<span class="mtag">${esc(t)}</span>`).join('')}</div>
        <div class="scard__foot">
          <span class="dim">${esc(p.ownerName)}${p.memberNames.length > 1 ? ` 외 ${p.memberNames.length - 1}명` : ''}</span>
          <span class="sp"></span>
          ${p.repoUrl ? `<a class="mbtn" href="${esc(p.repoUrl)}" target="_blank" rel="noopener noreferrer" style="padding:3px 10px;font-size:11.5px">코드 ↗</a>` : ''}
          ${p.demoUrl ? `<a class="mbtn" href="${esc(p.demoUrl)}" target="_blank" rel="noopener noreferrer" style="padding:3px 10px;font-size:11.5px">데모 ↗</a>` : ''}
          ${
            p.canManage
              ? `<button class="mbtn" data-public="${p.id}" data-on="${p.isPublic}" style="padding:3px 10px;font-size:11.5px">
                   ${p.isPublic ? '비공개로' : '공개하기'}</button>
                 <button class="mbtn" data-thumb="${p.id}" style="padding:3px 10px;font-size:11.5px">썸네일</button>`
              : ''
          }
        </div>
      </div>
    </article>`;
  }

  async function load(): Promise<void> {
    try {
      const rows = await api.member.portfolio.gallery(onlyPublic);
      document.getElementById('pfCount')!.textContent = `· ${rows.length}개`;
      list.innerHTML = rows.length
        ? rows.map(card).join('')
        : '<p class="mtop__desc">아직 등록된 완성작이 없습니다. 프로젝트를 만들고 완료 상태로 바꿔보세요.</p>';

      list.querySelectorAll<HTMLButtonElement>('[data-public]').forEach((b) =>
        b.addEventListener('click', () => {
          void api.member.portfolio
            .setPublic(b.dataset.public!, b.dataset.on !== 'true')
            .then(() => {
              toast('공개 설정을 변경했습니다.');
              void load();
            })
            .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
        }),
      );
      list.querySelectorAll<HTMLButtonElement>('[data-thumb]').forEach((b) =>
        b.addEventListener('click', () => {
          const url = prompt('썸네일 이미지 URL (비우면 삭제)');
          if (url === null) return;
          void api.member.portfolio
            .setThumbnail(b.dataset.thumb!, url.trim())
            .then(() => void load())
            .catch((e: unknown) => toast(e instanceof ApiError ? e.message : '실패했습니다.'));
        }),
      );
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '갤러리를 불러오지 못했습니다.'}</p>`;
    }
  }

  document.getElementById('fPublic')!.addEventListener('change', (e) => {
    onlyPublic = (e.target as HTMLInputElement).checked;
    void load();
  });

  await load();
}

void main();
