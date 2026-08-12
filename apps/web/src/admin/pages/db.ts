import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, initAdminPage, unlockModal, withElevation } from '../layout';

/** §8 DB 콘솔 — 읽기 전용 쿼리. elevated 세션(15분) 필요. */
async function main(): Promise<void> {
  const ctx = await initAdminPage('db');
  if (!ctx) return;

  ctx.content.innerHTML = `
    <div class="ahead"><h1>DB 콘솔</h1>
      <span class="hint">SELECT / WITH / SHOW / EXPLAIN 단일 쿼리 · 최대 200행 · READ ONLY 트랜잭션</span>
      <span class="sp"></span>
      <span class="elev off" id="elevBadge">잠김</span>
      <button class="mbtn" id="unlockBtn">잠금 해제</button></div>
    <div class="mpanel">
      <div class="mpanel__t">// query</div>
      <form class="mform" id="qForm">
        <textarea class="mctl mono" id="qSql" style="min-height:120px;font-size:13px"
          placeholder='SELECT "studentId", name, role FROM "User" ORDER BY "createdAt" DESC LIMIT 20'></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="mtop__desc">Ctrl+Enter 로 실행</span>
          <button class="mbtn mbtn--cy" type="submit">실행</button>
        </div>
      </form>
    </div>
    <div class="mpanel">
      <div class="mpanel__t">// 결과 <span id="qMeta" style="color:var(--dim)"></span></div>
      <div class="dbout" id="qOut"><p style="padding:14px;color:var(--dim)">아직 실행한 쿼리가 없습니다.</p></div>
    </div>
    <p class="mtop__desc">⚠ DB 접근 비밀번호는 웹에서 조회·변경할 수 없습니다. 서버 .env에서만 설정됩니다.</p>`;

  const setElev = (on: boolean) => {
    const b = document.getElementById('elevBadge')!;
    b.className = on ? 'elev' : 'elev off';
    b.textContent = on ? '🔓 elevated (15분)' : '잠김';
  };

  document.getElementById('unlockBtn')!.addEventListener('click', () => {
    void unlockModal().then((ok) => {
      if (ok) setElev(true);
    });
  });

  async function run(): Promise<void> {
    const sql = (document.getElementById('qSql') as HTMLTextAreaElement).value.trim();
    if (!sql) return;
    const out = document.getElementById('qOut')!;
    const meta = document.getElementById('qMeta')!;
    try {
      const r = await withElevation(() => api.admin.db.query(sql));
      setElev(true);
      const rows = r.rows as Array<Record<string, unknown>>;
      meta.textContent = `· ${rows.length}행${r.truncated ? ' (200행에서 잘림)' : ''}`;
      if (!rows.length) {
        out.innerHTML = '<p style="padding:14px;color:var(--dim)">결과가 없습니다.</p>';
        return;
      }
      const cols = Object.keys(rows[0]);
      out.innerHTML = `
        <table>
          <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${rows
            .map(
              (row) =>
                `<tr>${cols
                  .map((c) => {
                    const v = row[c];
                    const s = v === null ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v);
                    return `<td${v === null ? ' style="color:var(--dim)"' : ''}>${esc(s)}</td>`;
                  })
                  .join('')}</tr>`,
            )
            .join('')}</tbody>
        </table>`;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ELEVATION_REQUIRED') setElev(false);
      out.innerHTML = `<p style="padding:14px;color:var(--danger)">${esc(
        e instanceof ApiError ? e.message : '쿼리 실행에 실패했습니다.',
      )}</p>`;
      meta.textContent = '';
    }
  }

  document.getElementById('qForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    void run();
  });
  document.getElementById('qSql')!.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' && (e as KeyboardEvent).ctrlKey) {
      e.preventDefault();
      void run();
    }
  });
}

void main();
