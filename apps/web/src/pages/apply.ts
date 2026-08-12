// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import type { RecruitInfo, SessionUser } from '@sowl/shared';
import { initApplyForm } from '../components/applyForm';
import { mountFooter } from '../components/footer';
import { mountNav } from '../components/nav';
import { api } from '../lib/api';
import { mountOwl } from '../three/mount';
import { SITE } from '../config';

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);

function reveal(): void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));
}

/** 상단 게이트웨이 터미널 (모집 상태 + 절차) */
function applyGatewayInfo(info: RecruitInfo | null): void {
  const phase = info?.phase ?? 'open';
  const generation = info?.generation ?? SITE.generationFallback;

  const path = $('#gwPath');
  if (path) path.textContent = `~/sowl/recruit/${generation}th — gateway.sh`;

  const tag = $('#gwTag');
  if (tag) {
    tag.textContent = phase === 'open' ? 'OPEN' : phase === 'before' ? 'SOON' : 'CLOSED';
    tag.classList.toggle('soon', phase === 'before');
    tag.classList.toggle('closed', phase === 'closed');
  }

  const dday = $('#gwDday');
  if (dday) {
    if (!info) {
      dday.textContent = 'D-?';
    } else {
      const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
      const target = phase === 'before' ? info.startsAt : info.endsAt;
      const n = Math.max(
        0,
        Math.round((midnight(new Date(target).getTime()) - midnight(Date.now())) / 86_400_000),
      );
      dday.textContent = phase === 'closed' ? 'CLOSED' : `D-${n}`;
      const lb = document.querySelector('.gw-dday .lb');
      if (lb) lb.textContent = phase === 'before' ? '시작까지' : '마감까지';
    }
  }

  const gen = $('#gwGen');
  if (gen) gen.textContent = `${generation}기`;
  const period = $('#gwPeriod');
  if (period) period.textContent = info?.periodText ?? '-';
}

/** 폼 주변 정보 (터미널 경로·구글폼·메일·미니 카드) */
function applyFormInfo(info: RecruitInfo | null): void {
  const phase = info?.phase ?? 'open';
  const generation = info?.generation ?? SITE.generationFallback;

  const termPath = $('#termPath');
  if (termPath) termPath.textContent = `~/sowl/recruit/${generation}th — apply.sh`;
  const tag = $('#termTag');
  if (tag) {
    tag.textContent = phase === 'open' ? 'OPEN' : phase === 'before' ? 'SOON' : 'CLOSED';
    tag.classList.toggle('soon', phase === 'before');
    tag.classList.toggle('closed', phase === 'closed');
  }

  const gform = info?.googleFormUrl ?? SITE.googleFormUrl;
  for (const id of ['gformMid', 'gformDone']) {
    const a = document.getElementById(id) as HTMLAnchorElement | null;
    if (a) a.href = gform;
  }
  for (const id of ['mailLink', 'gwMail']) {
    const a = document.getElementById(id) as HTMLAnchorElement | null;
    if (a) {
      a.href = `mailto:${SITE.email}`;
      if (id === 'mailLink') a.textContent = SITE.email;
    }
  }

  const rows: Array<{ k: string; v: string; hl?: boolean }> = [
    { k: '모집 기수', v: `${generation}기`, hl: true },
    { k: '모집 기간', v: info?.periodText ?? '-' },
    { k: '모집 대상', v: '성공회대 재학생 누구나' },
    { k: '선발 방식', v: '서류 + 간단한 면담' },
    { k: '동아리방', v: SITE.room },
  ];
  const miRows = $('#miRows');
  if (miRows) {
    miRows.textContent = '';
    for (const r of rows) {
      const div = document.createElement('div');
      div.className = 'mini__row';
      const span = document.createElement('span');
      span.textContent = r.k;
      const b = document.createElement('b');
      if (r.hl) b.className = 'hl';
      b.textContent = r.v;
      div.append(span, b);
      miRows.appendChild(div);
    }
  }

  const looking = [
    '전공·학년 상관없이 개발이 궁금한 사람',
    '혼자보다 같이 만들 때 더 즐거운 사람',
    '밤새 삽질하고 아침에 웃을 수 있는 사람',
  ];
  const miLooking = $('#miLooking');
  if (miLooking) {
    miLooking.textContent = '';
    looking.forEach((t, i) => {
      const li = document.createElement('li');
      li.style.cssText = 'font-size:13.5px;color:var(--muted);display:flex;gap:9px';
      const num = document.createElement('span');
      num.style.cssText = 'color:var(--lime);font-family:var(--mono)';
      num.textContent = String(i + 1).padStart(2, '0');
      const txt = document.createElement('span');
      txt.textContent = t;
      li.append(num, txt);
      miLooking.appendChild(li);
    });
  }
}

async function main(): Promise<void> {
  mountNav();
  mountFooter();
  reveal();
  void mountOwl('apply');

  // 신청은 로그인과 무관 — 로그인 상태면 자동 채움에만 쓴다
  let info: RecruitInfo | null = null;
  let me: SessionUser | null = null;
  [info, me] = await Promise.all([
    api.recruit().catch(() => null),
    api.auth.me().catch(() => null),
  ]);

  applyGatewayInfo(info);
  applyFormInfo(info);
  initApplyForm(info, me);
}

void main();
