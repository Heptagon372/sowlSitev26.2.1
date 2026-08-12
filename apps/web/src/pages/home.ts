// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import type { RecruitInfo } from '@sowl/shared';
import { startCountdown } from '../components/countdown';
import { mountFooter } from '../components/footer';
import { mountNav } from '../components/nav';
import { api } from '../lib/api';
import { countUp } from '../lib/format';
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

function applyRecruitInfo(info: RecruitInfo | null): void {
  const phase = info?.phase ?? 'open';
  const generation = info?.generation ?? SITE.generationFallback;

  const badge = $('#badgeText');
  if (badge) {
    badge.textContent =
      phase === 'open'
        ? `소울 ${generation}기 모집중`
        : phase === 'before'
          ? `소울 ${generation}기 모집 예정`
          : `소울 ${generation}기 모집 마감`;
  }

  const pillGen = $('#pillGen');
  if (pillGen) pillGen.textContent = `${generation}기`;
  const pillPeriod = $('#pillPeriod');
  if (pillPeriod) pillPeriod.textContent = info?.periodText ?? '-';
  const pillRoom = $('#pillRoom');
  if (pillRoom) pillRoom.textContent = SITE.room;

  const defGen = $('#defGen');
  if (defGen) defGen.textContent = String(generation);

  const applyLabel = $('#ctaApplyLabel');
  if (applyLabel) {
    applyLabel.textContent =
      phase === 'closed' ? '지원 안내 보기' : `${generation}기 지원하기`;
  }

  const finaleTitle = $('#finaleTitle');
  if (finaleTitle) {
    finaleTitle.textContent =
      phase === 'open'
        ? `${generation}기 모집이 진행 중입니다`
        : phase === 'before'
          ? `${generation}기 모집이 곧 시작됩니다`
          : `${generation}기 모집이 마감되었습니다`;
  }

  const startsAt = new Date(info?.startsAt ?? SITE.fallbackStartsAt).getTime();
  const endsAt = new Date(info?.endsAt ?? SITE.fallbackEndsAt).getTime();

  const count = $('#count');
  if (count) {
    startCountdown(count, {
      startsAt,
      endsAt,
      phase,
      heading:
        phase === 'open'
          ? `${generation}기 모집 마감까지`
          : phase === 'before'
            ? `${generation}기 모집 시작까지`
            : `${generation}기 모집 마감`,
    });
    count.setAttribute(
      'aria-label',
      phase === 'before' ? '모집 시작까지 남은 시간' : '모집 마감까지 남은 시간',
    );
  }

  // 피날레 — 카운트다운은 히어로로 올라갔고, 여기엔 마감 D-day 한 줄만
  const dday = $('#finaleDday');
  if (dday) {
    const target = new Date(phase === 'before' ? startsAt : endsAt);
    const day = '일월화수목금토'[target.getDay()];
    const when = `${target.getMonth() + 1}월 ${target.getDate()}일 (${day}) ${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
    const left = Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86_400_000));
    dday.textContent =
      phase === 'open'
        ? `D-${left} · ${when} 마감`
        : phase === 'before'
          ? `${when} 모집 시작`
          : '다음 기수 모집을 기다려주세요';
  }
}

async function loadStats(): Promise<void> {
  // 자랑 숫자는 하드코딩하지 않는다 — 반드시 /api/stats 에서
  try {
    const stats = await api.stats();
    const members = $('#statMembers');
    const rack = $('#statRack');
    const projects = $('#statProjects');
    if (members) countUp(members, stats.members);
    if (rack) rack.textContent = stats.hasServerRack ? 'RACK' : '-';
    if (projects) countUp(projects, stats.projects, { suffix: '+' });
  } catch {
    for (const id of ['statMembers', 'statRack', 'statProjects']) {
      const el = document.getElementById(id);
      if (el) el.textContent = '–';
    }
  }
}

/** 둥지 카드 3D 틸트 (about 페이지와 같은 연출) */
function tiltRoom(): void {
  const card = $('#roomCard');
  if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${y * -10}deg)`;
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
  });
}

async function main(): Promise<void> {
  mountNav();
  mountFooter();
  reveal();
  tiltRoom();
  void mountOwl('index'); // 홈에서 가장 크고 진하게 (scale 1.0 · opacity 0.75)
  void loadStats();

  let info: RecruitInfo | null = null;
  try {
    info = await api.recruit();
  } catch {
    info = null; // 서버 다운 — 페이지는 열린다
  }
  applyRecruitInfo(info);
}

void main();
