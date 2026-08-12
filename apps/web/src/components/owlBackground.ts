/**
 * 히어로 배경 영상 — 잠든 부엉이가 눈을 뜨고, 그 눈 속으로 들어가면 네온 큐브 세계.
 *
 * 영상 두 개를 겹쳐 두고 이어 붙인다:
 *   1) 인트로(owl-awaken.mp4) — 눈 감김 → 눈 뜸 → 눈 속으로 → 큐브 세계 도착. 한 번만.
 *   2) 루프(owl-world-loop.mp4) — 큐브 세계의 이음매 없는 무한 반복 (F5 전까지).
 * 루프는 인트로 꼬리(8.0~10.0s)의 역방향+정방향 핑퐁이라
 * 루프 첫 프레임 == 인트로 마지막 프레임. 그래서 전환이 프레임 단위로 이어진다.
 * 눈 뜨는 연출은 첫 진입에서 한 번만 보여야 임팩트가 산다.
 *
 * 영상이 없거나(네트워크·코덱) 모션을 줄이는 설정이면 poster 정지 이미지로 남는다.
 */

/** 인트로 끝나기 몇 초 전에 루프로 넘어가기 시작할지 (timeupdate 해상도 ≈ 0.25s) */
const CROSSFADE = 0.35;

/** 히어로를 이만큼 지나면 배경 영상을 완전히 감춘다 (뷰포트 높이 배수) */
const FADE_OVER = 0.9;

export function mountOwlBackground(): void {
  const root = document.querySelector<HTMLElement>('.owlbg');
  const intro = document.querySelector<HTMLVideoElement>('#owlIntro');
  const loop = document.querySelector<HTMLVideoElement>('#owlLoop');
  if (!root || !intro || !loop) return;

  const play = (v: HTMLVideoElement): void => {
    void v.play().catch(() => undefined);
  };

  /* ---------- 스크롤에 따라 걷어내기 ---------- */
  const applyFade = (): void => {
    const p = Math.min(1, window.scrollY / (window.innerHeight * FADE_OVER));
    root.style.setProperty('--owlbg-fade', String(1 - p));
  };
  // 새로고침으로 이미 내려온 위치에서 열렸을 수도 있다 — 첫 값은 즉시 반영한다
  applyFade();

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        applyFade();
        ticking = false;
      });
    },
    { passive: true },
  );

  /* ---------- 모션을 줄이는 설정이면 정지 이미지로 끝 ---------- */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('is-ready');
    return;
  }

  /* ---------- 인트로 → 루프 ---------- */
  intro.addEventListener('canplay', () => root.classList.add('is-ready'), { once: true });
  // 인트로를 못 읽어도 poster는 남는다. 루프만이라도 살아 있으면 그걸로 넘어간다.
  intro.addEventListener(
    'error',
    () => {
      root.classList.add('is-ready', 'is-looping');
      play(loop);
    },
    { once: true },
  );

  let switched = false;
  const toLoop = (): void => {
    if (switched) return;
    switched = true;
    // 루프가 준비돼 있을 때만 넘긴다 — 아니면 인트로 마지막 화면을 그대로 둔다
    if (loop.readyState >= 2) {
      loop.currentTime = 0;
      play(loop);
      root.classList.add('is-looping');
    } else {
      intro.pause();
      loop.addEventListener(
        'canplay',
        () => {
          play(loop);
          root.classList.add('is-looping');
        },
        { once: true },
      );
    }
  };

  intro.addEventListener('timeupdate', () => {
    if (!Number.isFinite(intro.duration)) return;
    if (intro.currentTime >= intro.duration - CROSSFADE) toLoop();
  });
  intro.addEventListener('ended', toLoop);

  play(intro);

  // 자동재생이 막히면 첫 사용자 입력에서 한 번 더 시도한다
  const kick = (): void => {
    play(switched ? loop : intro);
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
  };
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });

  // 백그라운드 탭에서는 브라우저가 영상을 멈춰 둔다 — 다시 보이면 이어서 재생
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    play(switched ? loop : intro);
  });
}
