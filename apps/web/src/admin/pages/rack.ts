import { RACK_UNITS, type RackDeviceRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { confirmModal, esc, fmtDateTime, initAdminPage } from '../layout';

const KINDS = ['SERVER', 'SWITCH', 'UPS', 'NAS', 'ETC'];
const STATUSES: Array<{ v: string; label: string }> = [
  { v: 'OK', label: '정상' },
  { v: 'MAINTENANCE', label: '점검' },
  { v: 'OFFLINE', label: '오프라인' },
];

/** §9-3 서버랙 관리 — 42U 도면 + 장비 CRUD + 드래그 배치 + 헬스체크 */
async function main(): Promise<void> {
  const ctx = await initAdminPage('rack');
  if (!ctx) return;

  let devices: RackDeviceRow[] = [];
  let selected: string | null = null;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>서버랙 관리</h1>
      <span class="hint">여기 등록된 장비 수가 홈 자랑 스트립·/api/stats 에 반영됩니다 · 카드를 드래그해 위치 변경</span></div>
    <div class="rackview">
      <div class="rack42">
        <div class="rack42__title">S.OWL RACK — 42U · B1 NANUM</div>
        <div class="rack42__grid" id="rackGrid"></div>
      </div>
      <div>
        <div class="mpanel">
          <div class="mpanel__t" id="formTitle">// 장비 등록</div>
          <form class="mform" id="devForm">
            <div class="mgrid2">
              <div><label for="dName">이름</label><input class="mctl" id="dName" required maxlength="60" placeholder="vm-host-01" /></div>
              <div><label for="dKind">유형</label>
                <select class="mctl" id="dKind">${KINDS.map((k) => `<option>${k}</option>`).join('')}</select></div>
            </div>
            <div class="mgrid2">
              <div><label for="dStart">시작 유닛 (1~${RACK_UNITS})</label><input class="mctl" id="dStart" type="number" min="1" max="${RACK_UNITS}" required /></div>
              <div><label for="dSize">점유 U</label><input class="mctl" id="dSize" type="number" min="1" max="${RACK_UNITS}" value="1" required /></div>
            </div>
            <div class="mgrid2">
              <div><label for="dStatus">상태</label>
                <select class="mctl" id="dStatus">${STATUSES.map((s) => `<option value="${s.v}">${s.label}</option>`).join('')}</select></div>
              <div><label for="dPurpose">용도</label><input class="mctl" id="dPurpose" maxlength="200" placeholder="CI 러너" /></div>
            </div>
            <div class="mgrid2">
              <div><label for="dHealth">헬스체크 URL (선택)</label><input class="mctl" id="dHealth" maxlength="300" placeholder="http://10.0.0.5/health" /></div>
              <div><label for="dNote">메모</label><input class="mctl" id="dNote" maxlength="500" /></div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button class="mbtn" type="button" id="dReset">새 장비</button>
              <button class="mbtn mbtn--cy" type="submit" id="dSubmit">등록</button>
            </div>
          </form>
        </div>
        <div class="mpanel">
          <div class="mpanel__t">// 장비 목록 <span id="devCount" style="color:var(--dim)"></span></div>
          <div id="devList"></div>
        </div>
      </div>
    </div>`;

  const form = document.getElementById('devForm') as HTMLFormElement;
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
  const setVal = (id: string, v: string) => {
    (document.getElementById(id) as HTMLInputElement).value = v;
  };

  function selectDevice(d: RackDeviceRow | null): void {
    selected = d?.id ?? null;
    document.getElementById('formTitle')!.textContent = d
      ? `// 장비 수정 — ${d.name}`
      : '// 장비 등록';
    (document.getElementById('dSubmit') as HTMLButtonElement).textContent = d ? '저장' : '등록';
    setVal('dName', d?.name ?? '');
    setVal('dKind', d?.kind ?? 'SERVER');
    setVal('dStart', d ? String(d.startUnit) : '');
    setVal('dSize', d ? String(d.unitSize) : '1');
    setVal('dStatus', d?.status ?? 'OK');
    setVal('dPurpose', d?.purpose ?? '');
    setVal('dHealth', d?.healthUrl ?? '');
    setVal('dNote', d?.note ?? '');
    render();
  }

  function ledClass(status: string): string {
    return status === 'OK' ? '' : status === 'MAINTENANCE' ? 'warn' : 'off';
  }

  function render(): void {
    // 42U 세로 도면 — 위가 42U, 아래가 1U
    const grid = document.getElementById('rackGrid')!;
    const slotH = 20;
    grid.innerHTML = '';
    for (let u = RACK_UNITS; u >= 1; u--) {
      const slot = document.createElement('div');
      slot.className = 'rack42__slot';
      slot.dataset.u = String(u);
      slot.textContent = `${u}U`;
      grid.appendChild(slot);
    }
    for (const d of devices) {
      const top = (RACK_UNITS - (d.startUnit + d.unitSize - 1)) * slotH;
      const card = document.createElement('div');
      card.className = `rackdev${d.id === selected ? ' sel' : ''}`;
      card.style.top = `${top + 1}px`;
      card.style.height = `${d.unitSize * slotH - 3}px`;
      card.draggable = true;
      card.dataset.id = d.id;
      card.innerHTML = `<span class="led ${ledClass(d.status)}"></span><span>${esc(d.name)}</span><span class="u">${d.unitSize}U</span>`;
      card.addEventListener('click', () => selectDevice(d));
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', d.id);
      });
      grid.appendChild(card);
    }
    // 드롭 대상 슬롯
    grid.querySelectorAll<HTMLElement>('.rack42__slot').forEach((slot) => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.classList.add('drop');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('drop'));
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drop');
        const id = e.dataTransfer?.getData('text/plain');
        if (!id) return;
        void api.admin.rack
          .update(id, { startUnit: Number(slot.dataset.u) })
          .then(() => void load())
          .catch((err: unknown) =>
            toast(err instanceof ApiError ? err.message : '이동에 실패했습니다.'),
          );
      });
    });

    // 목록
    const list = document.getElementById('devList')!;
    document.getElementById('devCount')!.textContent = `· ${devices.length}대`;
    list.innerHTML = devices.length
      ? devices
          .map(
            (d) => `
        <div class="mrow" data-id="${d.id}">
          <span class="led ${ledClass(d.status)}" style="width:7px;height:7px;border-radius:50%;background:${
            d.status === 'OK' ? 'var(--lime)' : d.status === 'MAINTENANCE' ? '#fbbf24' : '#4b5563'
          };flex-shrink:0"></span>
          <span class="grow"><b>${esc(d.name)}</b> <span class="dim">${esc(d.kind)} · ${d.startUnit}${d.unitSize > 1 ? `~${d.startUnit + d.unitSize - 1}` : ''}U${d.purpose ? ` · ${esc(d.purpose)}` : ''}</span></span>
          ${d.lastSeenAt ? `<span class="dim" title="마지막 응답">${fmtDateTime(d.lastSeenAt)}</span>` : ''}
          ${d.healthUrl ? `<button class="mbtn" data-ping="${d.id}" style="padding:3px 10px;font-size:11px">체크</button>` : ''}
          <button class="mbtn mbtn--danger" data-del="${d.id}" style="padding:3px 10px;font-size:11px">삭제</button>
        </div>`,
          )
          .join('')
      : '<p class="mtop__desc">등록된 장비가 없습니다. 왼쪽 폼으로 첫 장비를 등록해 보세요.</p>';

    list.querySelectorAll<HTMLElement>('.mrow[data-id]').forEach((row) =>
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        selectDevice(devices.find((d) => d.id === row.dataset.id) ?? null);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-ping]').forEach((b) =>
      b.addEventListener('click', () => {
        b.disabled = true;
        void api.admin.rack
          .ping(b.dataset.ping!)
          .then((r) => {
            toast(r.ok ? '응답 확인!' : '응답이 없습니다.');
            void load();
          })
          .finally(() => {
            b.disabled = false;
          });
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        void (async () => {
          const d = devices.find((x) => x.id === b.dataset.del);
          const c = await confirmModal({
            title: '장비 삭제',
            message: `'${d?.name ?? ''}' 장비를 도면에서 제거할까요?`,
            confirmLabel: '삭제',
            danger: true,
          });
          if (!c.ok) return;
          await api.admin.rack.remove(b.dataset.del!);
          if (selected === b.dataset.del) selectDevice(null);
          void load();
        })();
      }),
    );
  }

  async function load(): Promise<void> {
    try {
      devices = await api.admin.rack.list();
      render();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      name: val('dName').trim(),
      kind: val('dKind'),
      startUnit: Number(val('dStart')),
      unitSize: Number(val('dSize')),
      status: val('dStatus'),
      purpose: val('dPurpose').trim() || null,
      healthUrl: val('dHealth').trim() || null,
      note: val('dNote').trim() || null,
    };
    const req = selected
      ? api.admin.rack.update(selected, payload)
      : api.admin.rack.create(payload);
    void req
      .then(() => {
        toast(selected ? '저장했습니다.' : '등록했습니다.');
        if (!selected) form.reset();
        void load();
      })
      .catch((err: unknown) =>
        toast(err instanceof ApiError ? err.message : '저장에 실패했습니다.'),
      );
  });

  document.getElementById('dReset')!.addEventListener('click', () => {
    form.reset();
    selectDevice(null);
  });

  await load();
}

void main();
