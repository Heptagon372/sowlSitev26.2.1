import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { initAdminPage } from '../layout';

/** 사이트 설정 — 모집 기수·기간·구글폼 URL, 자랑 숫자. DB 접근 비밀번호 변경 UI는 없다(§8). */
async function main(): Promise<void> {
  const ctx = await initAdminPage('settings');
  if (!ctx) return;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>사이트 설정</h1>
      <span class="hint">저장 즉시 홈·신청 페이지에 반영 · 변경 내역은 감사 로그에 남습니다</span></div>
    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 모집 설정</div>
        <form class="mform" id="rcForm">
          <div class="mgrid2">
            <div><label for="sGen">모집 기수</label><input class="mctl" id="sGen" type="number" min="1" required /></div>
            <div><label for="sForm">구글폼 URL</label><input class="mctl" id="sForm" required /></div>
          </div>
          <div class="mgrid2">
            <div><label for="sStart">모집 시작</label><input class="mctl" id="sStart" type="datetime-local" required /></div>
            <div><label for="sEnd">모집 마감</label><input class="mctl" id="sEnd" type="datetime-local" required /></div>
          </div>
          <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">저장</button></div>
        </form>
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 자랑 숫자 (홈 스트립)</div>
        <form class="mform" id="stForm">
          <div class="mgrid2">
            <div><label for="sMembers">활동 부원 수</label><input class="mctl" id="sMembers" type="number" min="0" required /></div>
            <div><label for="sProjects">누적 프로젝트</label><input class="mctl" id="sProjects" type="number" min="0" required /></div>
          </div>
          <div class="mgrid2">
            <div><label for="sServers">서버 대수 <span style="letter-spacing:0;color:var(--dim)">(랙 장비 등록 시 그 수가 우선)</span></label>
              <input class="mctl" id="sServers" type="number" min="0" required /></div>
            <div><label for="sRoom">동아리방 위치</label><input class="mctl" id="sRoom" required /></div>
          </div>
          <div style="display:flex;justify-content:flex-end"><button class="mbtn mbtn--cy" type="submit">저장</button></div>
        </form>
      </div>
    </div>
    <p class="mtop__desc" style="margin-top:6px">
      ⚠ DB 접근 비밀번호(DB_ACCESS_PASSPHRASE)는 이 화면에서 바꿀 수 없습니다.
      서버의 .env 를 수정하고 서비스를 재시작해야 합니다 — 다른 경로는 없습니다.
    </p>`;

  const setVal = (id: string, v: string | number) => {
    (document.getElementById(id) as HTMLInputElement).value = String(v);
  };
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };

  try {
    const s = await api.admin.settings.get();
    setVal('sGen', s.generation);
    setVal('sForm', s.googleFormUrl);
    setVal('sStart', toLocal(s.startsAt));
    setVal('sEnd', toLocal(s.endsAt));
    setVal('sMembers', s.stats.members);
    setVal('sProjects', s.stats.projects);
    setVal('sServers', s.stats.servers);
    setVal('sRoom', s.stats.roomLocation);
  } catch (e) {
    toast(e instanceof ApiError ? e.message : '설정을 불러오지 못했습니다.');
  }

  document.getElementById('rcForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    void api.admin.settings
      .patch({
        generation: Number(val('sGen')),
        googleFormUrl: val('sForm').trim(),
        startsAt: new Date(val('sStart')).toISOString(),
        endsAt: new Date(val('sEnd')).toISOString(),
      })
      .then(() => toast('모집 설정을 저장했습니다.'))
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '저장에 실패했습니다.'),
      );
  });

  document.getElementById('stForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    void api.admin.settings
      .patch({
        stats: {
          members: Number(val('sMembers')),
          projects: Number(val('sProjects')),
          servers: Number(val('sServers')),
          roomLocation: val('sRoom').trim(),
        },
      })
      .then(() => toast('자랑 숫자를 저장했습니다.'))
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '저장에 실패했습니다.'),
      );
  });
}

void main();
