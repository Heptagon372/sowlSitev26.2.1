import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

const KIND_LABEL: Record<string, string> = {
  SEMINAR_ATTEND: '세미나 출석',
  MISSION_SCORE: '과제 채점',
  STUDY_JOIN: '스터디 참여',
  MANUAL: '수동 지급',
};

/** #24 동아리 포인트 / 랭킹 — 적립 내역 + 기수별 랭킹 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('points');
  if (!ctx) return;
  const { content } = ctx;

  content.innerHTML = `
    <div class="mgrid3" style="margin-bottom:18px">
      <div class="mstat"><div class="v" id="myPoints">-</div><div class="t">내 포인트</div></div>
      <div class="mstat"><div class="v" id="myRank">-</div><div class="t">내 순위</div></div>
      <div class="mstat"><div class="v" id="topName" style="font-size:19px">-</div><div class="t">1위</div></div>
    </div>

    <div class="mgrid2">
      <div class="mpanel">
        <div class="mpanel__t">// 랭킹
          <span class="sp"></span>
          <select class="mctl" id="fGen" style="max-width:130px;padding:6px 10px">
            <option value="">기수: 전체</option>
          </select>
        </div>
        <div id="rankList"></div>
      </div>
      <div class="mpanel">
        <div class="mpanel__t">// 내 적립 내역</div>
        <div id="logList"></div>
        <p class="mtop__desc" style="margin-top:12px">포인트는 세미나 출석·과제 채점에서 자동으로 쌓입니다.</p>
      </div>
    </div>`;

  const genSel = document.getElementById('fGen') as HTMLSelectElement;

  async function load(): Promise<void> {
    try {
      const gen = genSel.value ? Number(genSel.value) : undefined;
      const p = await api.member.points(gen);

      document.getElementById('myPoints')!.innerHTML = `${p.myPoints}<small style="font-size:13px">pt</small>`;
      document.getElementById('myRank')!.textContent = p.myRank ? `${p.myRank}위` : '-';
      document.getElementById('topName')!.textContent = p.ranking[0]?.name ?? '-';

      if (genSel.options.length === 1 && p.generations.length) {
        for (const g of p.generations) {
          const o = document.createElement('option');
          o.value = String(g);
          o.textContent = `${g}기`;
          genSel.appendChild(o);
        }
      }

      const max = p.ranking[0]?.points || 1;
      document.getElementById('rankList')!.innerHTML = p.ranking.length
        ? p.ranking
            .map(
              (r) => `
        <div class="rankrow${r.isMe ? ' me' : ''}">
          <span class="rankrow__no mono">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
          <span class="rankrow__name">${esc(r.name)}${r.isMe ? ' <span class="mtag">나</span>' : ''}</span>
          <span class="dim">${r.generation ? `${r.generation}기` : ''}</span>
          <span class="rankrow__bar"><i style="width:${Math.round((r.points / max) * 100)}%"></i></span>
          <b class="mono">${r.points}</b>
        </div>`,
            )
            .join('')
        : '<p class="mtop__desc">아직 랭킹이 없습니다.</p>';

      document.getElementById('logList')!.innerHTML = p.logs.length
        ? p.logs
            .map(
              (l) => `
        <div class="mrow" style="cursor:default">
          <span class="mtag">${esc(KIND_LABEL[l.kind] ?? l.kind)}</span>
          <span class="grow">${esc(l.reason)}</span>
          <b class="mono" style="color:${l.delta >= 0 ? 'var(--lime)' : 'var(--danger)'}">${l.delta > 0 ? '+' : ''}${l.delta}</b>
          <span class="dim">${fmtDateTime(l.createdAt)}</span>
        </div>`,
            )
            .join('')
        : '<p class="mtop__desc">아직 적립 내역이 없습니다. 세미나에 출석해 보세요!</p>';
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '포인트를 불러오지 못했습니다.');
    }
  }

  genSel.addEventListener('change', () => void load());
  await load();
}

void main();
