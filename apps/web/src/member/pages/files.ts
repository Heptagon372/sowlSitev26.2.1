import { FILE_CATEGORIES } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, fmtSize, initMemberPage } from '../layout';

/** #10 자료실 — 동아리 공용 자료 (카테고리·검색·업로드·다운로드) */
async function main(): Promise<void> {
  const ctx = await initMemberPage('files');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 파일 올리기 <span style="color:var(--dim);letter-spacing:0">(최대 25MB)</span></div>
      <form class="mform" id="upForm" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px">
        <input class="mctl" id="upFile" type="file" required style="flex:1;min-width:220px" />
        <select class="mctl" id="upCat" style="max-width:130px">
          ${FILE_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
        </select>
        <button class="mbtn mbtn--cy" type="submit" id="upBtn">업로드</button>
      </form>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 자료
        <span class="sp"></span>
        <select class="mctl" id="fCat" style="max-width:130px;padding:6px 10px">
          <option value="">전체</option>
          ${FILE_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
        </select>
        <input class="mctl" id="fQ" placeholder="파일명 검색" style="max-width:190px;padding:6px 10px" />
      </div>
      <div style="overflow-x:auto">
        <table class="mtable">
          <thead><tr><th>파일명</th><th>분류</th><th>크기</th><th>올린 사람</th><th>받기</th><th>날짜</th><th></th></tr></thead>
          <tbody id="fBody"></tbody>
        </table>
      </div>
    </div>`;

  let debounce: number | undefined;

  async function load(): Promise<void> {
    const category = (document.getElementById('fCat') as HTMLSelectElement).value;
    const q = (document.getElementById('fQ') as HTMLInputElement).value.trim();
    const body = document.getElementById('fBody')!;
    try {
      const files = await api.member.files.list({
        category: category || undefined,
        q: q || undefined,
      });
      body.innerHTML = files.length
        ? files
            .map(
              (f) => `
          <tr>
            <td><a href="${api.member.files.downloadUrl(f.id)}" download style="color:var(--cyan-hi)">${esc(f.name)}</a></td>
            <td><span class="mtag">${esc(f.category)}</span></td>
            <td class="mono" style="font-size:12px">${fmtSize(f.size)}</td>
            <td>${esc(f.uploaderName)}</td>
            <td class="mono" style="font-size:12px">${f.downloads}회</td>
            <td class="mono" style="font-size:12px">${fmtDate(f.createdAt)}</td>
            <td>${
              f.uploaderId === me.id || isAdmin
                ? `<button class="mbtn mbtn--danger" data-del="${f.id}" style="padding:2px 9px;font-size:11px">삭제</button>`
                : ''
            }</td>
          </tr>`,
            )
            .join('')
        : '<tr><td colspan="7" style="text-align:center;color:var(--dim)">자료가 없습니다</td></tr>';

      body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!confirm('이 파일을 삭제할까요?')) return;
          void api.member.files.remove(b.dataset.del!).then(() => void load());
        }),
      );
    } catch (e) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim)">${
        e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다'
      }</td></tr>`;
    }
  }

  document.getElementById('upForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('upFile') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast('25MB 이하 파일만 올릴 수 있습니다.');
      return;
    }
    const btn = document.getElementById('upBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '올리는 중...';
    void api.member.files
      .upload(file, (document.getElementById('upCat') as HTMLSelectElement).value)
      .then(() => {
        toast('업로드했습니다.');
        input.value = '';
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '업로드에 실패했습니다.'),
      )
      .finally(() => {
        btn.disabled = false;
        btn.textContent = '업로드';
      });
  });

  document.getElementById('fCat')!.addEventListener('change', () => void load());
  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 300);
  });

  await load();
}

void main();
