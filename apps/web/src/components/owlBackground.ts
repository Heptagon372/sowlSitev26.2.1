/**
 * 히어로 배경 영상 — 잠든 부엉이가 눈을 뜨고, 그 눈 속으로 들어가 디지털 세계가 된다.
 *
 * 10초 영상의 구성(실측):
 *   0~2s 눈 감김 · 2~7s 눈 뜸 + 눈으로 접근 · 약 8s 섬광 · 8.5~9.5s 디지털 세계
 * 디지털 구간이 1.5초뿐이라 반복하면 튄다. 그래서 한 번만 재생하고 HOLD_AT 에서
 * 멈춰 그 화면을 배경으로 눌러앉힌다. 이후의 미세한 움직임은 CSS 드리프트가 맡는다.
 * (마지막 10초 프레임은 다시 어두워지므로 일부러 그 앞에서 잡는다)
 */

/** 배경으로 눌러앉힐 지점(초) — 디지털 세계가 가장 잘 보이는 프레임 */
const HOLD_AT = 9.4;

/** 히어로를 이만큼 지나면 배경 영상을 완전히 감춘다 (뷰포트 높이 배수) */
const FADE_OVER = 0.9;

export function mountOwlBackground(): void {
  const root = document.querySelector<HTMLElement>('.owlbg');
  const video = document.querySelector<HTMLVideoElement>('#owlVideo');
  if (!root || !video) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    // 정지 이미지(poster)만 보여준다 — 재생하지 않는다
    root.classList.add('is-ready');
    return;
  }

  video.addEventListener(
    'canplay',
    () => {
      root.classList.add('is-ready');
    },
    { once: true },
  );

  // 재생 실패(자동재생 차단 등)해도 poster는 남으므로 배경은 비지 않는다
  video.addEventListener('error', () => root.classList.add('is-ready'), { once: true });

  // 디지털 세계에 닿으면 멈춰서 그대로 배경이 된다 — 눈은 다시 감기지 않는다
  const settle = (): void => {
    if (root.classList.contains('is-settled')) return;
    root.classList.add('is-settled');
    video.pause();
  };
  video.addEventListener('timeupdate', () => {
    if (video.currentTime >= HOLD_AT) settle();
  });
  video.addEventListener('ended', settle);

  void video.play().catch(() => {
    // 자동재생이 막히면 첫 사용자 입력에서 한 번 더 시도한다
    const kick = (): void => {
      void video.play().catch(() => undefined);
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  });

  // 히어로를 지나면 서서히 걷어낸다 — 아래 섹션은 원래의 어두운 배경으로
  const apply = (): void => {
    const p = Math.min(1, window.scrollY / (window.innerHeight * FADE_OVER));
    root.style.setProperty('--owlbg-fade', String(1 - p));
  };

  // 새로고침으로 이미 내려온 위치에서 열렸을 수도 있다 — 첫 값은 즉시 반영한다
  apply();

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        apply();
        ticking = false;
      });
    },
    { passive: true },
  );
}
