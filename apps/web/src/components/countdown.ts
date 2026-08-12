import type { RecruitPhase } from '@sowl/shared';

/**
 * D-day 카운트다운 (DAYS : HOURS : MINS : SECS)
 * - before → 시작까지, open → 마감까지, closed → 00:00:00:00
 * - 자릿수마다 0–9 트랙을 세로로 굴리는 오도미터 애니메이션 (countdown CSS: .cd)
 * - DOM은 이 모듈이 전부 그린다 — HTML 셸에는 빈 #count 컨테이너만 둔다
 */

interface CountdownOpts {
  startsAt: number;
  endsAt: number;
  phase: RecruitPhase;
  /** 모노 어깨글 — 예: "15기 모집 마감까지" */
  heading?: string;
}

const UNITS = [
  { u: 'd', lb: 'Days' },
  { u: 'h', lb: 'Hours' },
  { u: 'm', lb: 'Mins' },
  { u: 's', lb: 'Secs' },
] as const;

type UnitKey = (typeof UNITS)[number]['u'];

/** 0–9가 세로로 쌓인 롤링 디지트 한 자리 */
function createDigit(): HTMLElement {
  const digit = document.createElement('span');
  digit.className = 'cd__digit';
  const track = document.createElement('span');
  track.className = 'cd__track';
  for (let i = 0; i <= 9; i++) {
    const glyph = document.createElement('i');
    glyph.textContent = String(i);
    track.appendChild(glyph);
  }
  digit.appendChild(track);
  return digit;
}

function buildDom(root: HTMLElement, heading: string) {
  root.classList.add('cd');
  root.textContent = '';

  const head = document.createElement('div');
  head.className = 'cd__head mono';
  head.innerHTML = `<span class="cd__dot" aria-hidden="true"></span><span class="cd__phase"></span>`;
  root.appendChild(head);

  const row = document.createElement('div');
  row.className = 'cd__row';
  const units = new Map<UnitKey, { card: HTMLElement; digits: HTMLElement[] }>();

  UNITS.forEach(({ u, lb }, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'cd__sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.innerHTML = '<i></i><i></i>';
      row.appendChild(sep);
    }
    const unit = document.createElement('div');
    unit.className = `cd__unit cd__unit--${u}`;
    const card = document.createElement('div');
    card.className = 'cd__card';
    card.innerHTML = '<span class="cd__shine" aria-hidden="true"></span>';
    const digits = [createDigit(), createDigit()];
    for (const d of digits) card.appendChild(d);
    const label = document.createElement('span');
    label.className = 'cd__lb mono';
    label.textContent = lb;
    unit.appendChild(card);
    unit.appendChild(label);
    row.appendChild(unit);
    units.set(u, { card, digits });
  });
  root.appendChild(row);

  const prog = document.createElement('div');
  prog.className = 'cd__prog';
  prog.setAttribute('aria-hidden', 'true');
  prog.innerHTML = '<i></i>';
  root.appendChild(prog);

  const phaseEl = root.querySelector<HTMLElement>('.cd__phase');
  if (phaseEl) phaseEl.textContent = heading;

  return { units, progFill: prog.querySelector<HTMLElement>('i'), phaseEl };
}

/** 트랙을 해당 숫자 위치로 굴린다 + 값이 바뀐 칸은 반짝 */
function setUnit(
  entry: { card: HTMLElement; digits: HTMLElement[] },
  value: number,
  prev: number | null,
): void {
  const text = String(Math.min(99, value)).padStart(2, '0');
  entry.digits.forEach((digit, i) => {
    const n = Number(text[i]);
    const track = digit.firstElementChild as HTMLElement | null;
    if (track) track.style.transform = `translateY(${-n}em)`;
  });
  if (prev !== null && prev !== value) {
    entry.card.classList.remove('tick');
    // 리플로우 강제 — 연속 tick에서도 애니메이션이 재시작되게
    void entry.card.offsetWidth;
    entry.card.classList.add('tick');
  }
}

export function startCountdown(root: HTMLElement, opts: CountdownOpts): () => void {
  const heading = opts.heading ?? '모집 마감까지';
  const { units, progFill, phaseEl } = buildDom(root, heading);
  const target = opts.phase === 'before' ? opts.startsAt : opts.endsAt;
  const span = Math.max(1, opts.endsAt - opts.startsAt);
  const prev: Record<UnitKey, number | null> = { d: null, h: null, m: null, s: null };

  const tick = () => {
    let dist = target - Date.now();
    if (opts.phase === 'closed' || dist < 0) dist = 0;

    const v: Record<UnitKey, number> = {
      d: Math.floor(dist / 86_400_000),
      h: Math.floor((dist % 86_400_000) / 3_600_000),
      m: Math.floor((dist % 3_600_000) / 60_000),
      s: Math.floor((dist % 60_000) / 1000),
    };
    for (const [u, entry] of units) {
      setUnit(entry, v[u], prev[u]);
      prev[u] = v[u];
    }

    // 마지막 24시간 — 긴급 모드 (마젠타 펄스)
    root.classList.toggle('cd--urgent', dist > 0 && dist <= 86_400_000);

    if (dist === 0) {
      root.classList.add('cd--closed');
      if (opts.phase !== 'before' && phaseEl) phaseEl.textContent = '이번 기수 모집이 마감되었습니다';
    }

    // 게이지 — open: 남은 기간 비율만큼 차 있다가 마감으로 갈수록 준다
    //          before: 시작 30일 전부터 차오른다
    if (progFill) {
      const frac =
        opts.phase === 'before'
          ? Math.max(0, 1 - dist / 2_592_000_000)
          : Math.min(1, dist / span);
      progFill.style.width = `${(frac * 100).toFixed(2)}%`;
    }
  };

  tick();
  // 초 경계에 정렬 — 롤이 정확히 1초 간격으로 떨어진다
  let id = 0;
  const align = window.setTimeout(() => {
    tick();
    id = window.setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));

  return () => {
    window.clearTimeout(align);
    window.clearInterval(id);
  };
}
