import { FILE_CATEGORIES, type StudyRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDate, fmtSize, initMemberPage } from '../layout';

/** #6 스터디 자료실 — 스터디를 고르면 그 스터디 전용 자료만 오간다 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('study-files');
  if (!ctx) return;
  const { me, content } = ctx;
  const isAdmin = me.role === 'ADMIN';

  let studies: StudyRow[] = [];
  let current = new URLSearchParams(location.search).get('study') ?? '';

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 스터디 선택
        <span class="sp"></span>
        <select class="mctl" id="studySel" style="max-width:280px;padding:6px 10px"></select>
      </div>
      <p class="mtop__desc" id="studyInfo">스터디를 고르면 그 스터디의 자료만 보입니다.</p>
    </div>

    <div class="mpanel" id="upPanel" hidden>
      <div class="mpanel__t">// 자료 올리기 <span style="color:var(--dim);letter-spacing:0">(최대 25MB)</span></div>
      <form class="mform" id="upForm" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px">
        <input class="mctl" id="upFile" type="file" required style="flex:1;min-width:220px" />
        <select class="mctl" id="upCat" style="max-width:130px">
          ${FILE_CATEGORIES.map((c) => `<option${c === '스터디' ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
        <button class="mbtn mbtn--cy" type="submit" id="upBtn">업로드</button>
      </form>
    </div>

    <div class="mpanel" id="listPanel" hidden>
      <div class="mpanel__t">// 자료 <span id="fCount" style="color:var(--dim)"></span>
        <span class="sp"></span>
        <input class="mctl" id="fQ" placeholder="파일명 검색" style="max-width:190px;padding:6px 10px" />
      </div>
      <div style="overflow-x:auto">
        <table class="mtable">
          <thead><tr><th>파일명</th><th>분류</th><th>크기</th><th>올린 사람</th><th>받기</th><th>날짜</th><th></th></tr></thead>
          <tbody id="fBody"></tbody>
        </table>
      </div>
    </div>`;

  const sel = document.getElementById('studySel') as HTMLSelectElement;
  const upPanel = document.getElementById('upPanel')!;
  const listPanel = document.getElementById('listPanel')!;
  let debounce: number | undefined;

  function renderStudyOptions(): void {
    sel.innerHTML =
      '<option value="">— 스터디를 선택하세요 —</option>' +
      studies
        .map(
          (s) =>
            `<option value="${s.id}"${s.id === current ? ' selected' : ''}>${esc(s.title)}${s.joinedByMe ? ' (참여 중)' : ''}</option>`,
        )
        .join('');
  }

  async function loadFiles(): Promise<void> {
    const body = document.getElementById('fBody')!;
    const study = studies.find((s) => s.id === current);
    const canUpload = !!study && (study.joinedByMe || isAdmin);

    upPanel.hidden = !canUpload;
    listPanel.hidden = !current;
    document.getElementById('studyInfo')!.textContent = study
      ? `${study.title} · 👑 ${study.leaderName} · ${study.memberCount}명${
          canUpload ? '' : ' — 참여 중인 부원만 자료를 올릴 수 있습니다.'
        }`
      : '스터디를 고르면 그 스터디의 자료만 보입니다.';
    if (!current) return;

    try {
      const files = await api.member.files.list({
        studyId: current,
        q: (document.getElementById('fQ') as HTMLInputElement).value.trim() || undefined,
      });
      document.getElementById('fCount')!.textContent = `· ${files.length}개`;
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
        : '<tr><td colspan="7" style="text-align:center;color:var(--dim)">아직 올라온 자료가 없습니다</td></tr>';

      body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!confirm('이 파일을 삭제할까요?')) return;
          void api.member.files.remove(b.dataset.del!).then(() => void loadFiles());
        }),
      );
    } catch (e) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim)">${
        e instanceof ApiError ? esc(e.message) : '목록을 불러오지 못했습니다'
      }</td></tr>`;
    }
  }

  sel.addEventListener('change', () => {
    current = sel.value;
    const url = new URL(location.href);
    if (current) url.searchParams.set('study', current);
    else url.searchParams.delete('study');
    history.replaceState(null, '', url);
    void loadFiles();
  });

  document.getElementById('upForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('upFile') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !current) return;
    if (file.size > 25 * 1024 * 1024) {
      toast('25MB 이하 파일만 올릴 수 있습니다.');
      return;
    }
    const btn = document.getElementById('upBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '올리는 중...';
    void api.member.files
      .upload(file, (document.getElementById('upCat') as HTMLSelectElement).value, current)
      .then(() => {
        toast('업로드했습니다.');
        input.value = '';
        void loadFiles();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '업로드에 실패했습니다.'),
      )
      .finally(() => {
        btn.disabled = false;
        btn.textContent = '업로드';
      });
  });

  document.getElementById('fQ')!.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void loadFiles(), 300);
  });

  try {
    studies = await api.member.studies.list();
  } catch {
    toast('스터디 목록을 불러오지 못했습니다.');
  }
  // 참여 중인 스터디를 위로
  studies.sort((a, b) => Number(b.joinedByMe) - Number(a.joinedByMe));
  if (!current) current = studies.find((s) => s.joinedByMe)?.id ?? '';
  renderStudyOptions();
  await loadFiles();
}

void main();
