/**
 * 페이지별 3D 부엉이 마운트 + 폴백.
 * Three.js는 동적 import — 초기 번들에 포함되지 않는다.
 */

export interface OwlVariant {
  cameraZ: number;
  cameraX?: number;
  cameraY?: number;
  lookAtX?: number;
  lookAtY?: number;
  scale: number;
  opacity: number;
  offsetX?: number;
  offsetY?: number;
  tiltX?: number;
}

const VARIANTS: Record<string, OwlVariant> = {
  // 정면, 크게
  index: { cameraZ: 5, scale: 1.0, opacity: 0.75 },
  // 살짝 위에서 내려다봄, 우측 치우침
  about: { cameraZ: 5.2, cameraY: 1.4, lookAtY: 0, scale: 0.9, opacity: 0.45, offsetX: 1.6, tiltX: 0.12 },
  // 뒤로 물러남
  activities: { cameraZ: 6.4, scale: 0.7, opacity: 0.35 },
  // 좌측 하단, 작게
  faq: { cameraZ: 6.2, scale: 0.55, opacity: 0.3, offsetX: -2.2, offsetY: -1.4 },
  // 우측에서 지켜보는 부엉이
  apply: { cameraZ: 5.6, scale: 0.85, opacity: 0.5, offsetX: 1.9, offsetY: -0.2 },
};

/** WebGL 컨텍스트 생성 가능 여부를 미리 확인한다 */
function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export async function mountOwl(page: keyof typeof VARIANTS): Promise<void> {
  const variant = VARIANTS[page];
  if (!variant) return;

  if (!webglSupported()) {
    document.body.classList.add('no-webgl');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'owl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  try {
    const { OwlScene } = await import('./OwlScene');
    new OwlScene(canvas, variant);
  } catch {
    // 로드·초기화 실패 → 캔버스 제거하고 CSS 폴백
    canvas.remove();
    document.body.classList.add('no-webgl');
  }
}
