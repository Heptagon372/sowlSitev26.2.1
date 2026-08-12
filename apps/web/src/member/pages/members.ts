import { ApiError, api } from '../../lib/api';
import { esc, initMemberPage } from '../layout';

/** #26 회원 목록 — 기수·전공 필터 (연락처는 서버가 아예 내려주지 않는다) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('members');
  if (!ctx) return;
  const { content } = ctx;

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 필터</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <input class="mctl" id="fQ" placeholder="이름 검색" style="max-width:200px" />
        <input class="mctl" id="fGen" placeholder="기수 (예: 15)" inputmode="numeric" style="max-width:130px" />
        <input class="mctl" id="fDept" placeholder="전공" style="max-width:180px" />
      </div>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 부원 <span id="mCount" style="color:var(--dim)"></span></div>
      <div style="overflow-x:auto">
        <table class="mtable">
          <thead><tr><th>이름</th><th>기수</th><th>전공</th><th>기술 스택</th><th>GitHub</th></tr></thead>
          <tbody id="mBody"></tbody>
        </table>
      </div>
    </div>`;

  let debounce: number | undefined;

  async function load(): Promise<void> {
    const q = (document.getElementById('fQ') as HTMLInputElement).value.trim();
    const generation = (document.getElementById('fGen') as HTMLInputElement).value.trim();
    const department = (document.getElementById('fDept') as HTMLInputElement).value.trim();
    const body = document.getElementById('mBody')!;
    try {
      const rows = await api.member.members({
        q: q || undefined,
        generation: generation || undefined,
        department: department || undefined,
      });
      document.getElementById('mCount')!.textContent = `· ${rows.length}명`;
      body.innerHTML = rows.length
        ? rows
            .map(
              (m) => `
          <tr>
            <td><b>${esc(m.name)}</b> ${m.role === 'ADMIN' ? '<span class="rolebadge rolebadge--admin">관리자</span>' : ''}</td>
            <td>${m.generation ? `${m.generation}기` : '-'}</td>
            <td>${m.department ? esc(m.department) : '-'}</td>
            <td>${m.techStack.length ? m.techStack.map((t) => `<span class="mtag">${esc(t)}</span>`).join('') : '<span class="dim">-</span>'}</td>
            <td>${
              m.githubLogin
                ? `<a href="https://github.com/${encodeURIComponent(m.githubLogin)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">@${esc(m.githubLogin)}</a>`
                : '-'
            }</td>
          </tr>`,
            )
            .join('')
        : '<tr><td colspan="5" style="text-align:center;color:var(--dim)">조건에 맞는 부원이 없습니다</td></tr>';
    } catch (e) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--dim)">${
        e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다'
      }</td></tr>`;
    }
  }

  for (const id of ['fQ', 'fGen', 'fDept']) {
    document.getElementById(id)!.addEventListener('input', () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void load(), 300);
    });
  }

  await load();
}

void main();
