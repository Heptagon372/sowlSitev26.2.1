/** 입력 중 자동 하이픈 — 01X-XXXX-XXXX */
export function fmtPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 학번 — 숫자만, 최대 10자리 */
export function fmtStudentId(v: string): string {
  return v.replace(/\D/g, '').slice(0, 10);
}

/** JSON 구문 하이라이팅 (프리뷰용) */
export function highlightJSON(obj: unknown): string {
  const s = JSON.stringify(obj, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return s.replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?)/g,
    (m) => {
      let cls = 'n';
      if (m.charAt(0) === '"') cls = /:\s*$/.test(m) ? 'k' : 's';
      else if (m === 'true' || m === 'false') cls = 'b';
      else if (m === 'null') cls = 'nul';
      return `<span class="${cls}">${m}</span>`;
    },
  );
}

/** 숫자 카운트업 애니메이션 */
export function countUp(
  el: HTMLElement,
  target: number,
  opts: { duration?: number; suffix?: string } = {},
): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const suffix = opts.suffix ?? '';
  if (reduced || target <= 0) {
    el.textContent = `${target}${suffix}`;
    return;
  }
  const duration = opts.duration ?? 1400;
  const start = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  let done = false;
  const frame = (now: number) => {
    if (done) return;
    const p = Math.min(1, (now - start) / duration);
    el.textContent = `${Math.round(ease(p) * target)}${suffix}`;
    if (p < 1) requestAnimationFrame(frame);
    else done = true;
  };
  requestAnimationFrame(frame);
  // 탭이 백그라운드면 rAF가 멈추므로 최종값을 보장한다
  window.setTimeout(() => {
    if (!done) {
      done = true;
      el.textContent = `${target}${suffix}`;
    }
  }, duration + 300);
}

/** ISO → 'YYYY.MM.DD HH:mm' (로컬) */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
