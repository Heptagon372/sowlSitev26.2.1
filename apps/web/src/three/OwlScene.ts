import * as THREE from 'three';
import { buildOwl, type OwlRefs } from './buildOwl';
import type { OwlVariant } from './mount';

/**
 * 3D 부엉이 배경 씬 — 회전·부유·마우스 패럴랙스·눈 깜빡임.
 * 성능 가드: pixelRatio 제한 · 탭 숨김/화면 밖 정지 · reduced-motion 시 정지 프레임 1회.
 */
export class OwlScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private owl: OwlRefs;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private visible = true;
  private reduced: boolean;
  private mouse = { x: 0, y: 0 };
  private baseZ: number;
  private nextBlink = 0;
  private blinkStart = -1;

  constructor(
    private canvas: HTMLCanvasElement,
    private variant: OwlVariant,
  ) {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.baseZ = variant.cameraZ;
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      50,
    );
    this.camera.position.set(variant.cameraX ?? 0, variant.cameraY ?? 0.2, this.baseZ);
    this.camera.lookAt(variant.lookAtX ?? 0, variant.lookAtY ?? 0.2, 0);

    this.owl = buildOwl();
    this.owl.group.scale.setScalar(this.variant.scale);
    this.owl.group.position.x = this.variant.offsetX ?? 0;
    this.owl.group.position.y = this.variant.offsetY ?? 0;
    if (this.variant.tiltX) this.owl.group.rotation.x = this.variant.tiltX;
    this.applyOpacity(this.variant.opacity);
    this.scene.add(this.owl.group);

    this.scheduleBlink(0);

    if (this.reduced) {
      // 정면 정지 프레임 1회만 렌더
      this.renderer.render(this.scene, this.camera);
      return;
    }

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    // 캔버스가 화면 밖이면 정지 (fixed full-viewport라 대부분 보이지만, 규격대로 가드)
    const io = new IntersectionObserver((entries) => {
      this.visible = entries[0]?.isIntersecting ?? true;
      this.updateRunning();
    });
    io.observe(canvas);

    this.start();
  }

  private applyOpacity(mult: number): void {
    for (const m of this.owl.materials.lines) m.opacity *= mult;
    for (const m of this.owl.materials.points) m.opacity *= mult;
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  private onPointer = (e: PointerEvent): void => {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private onVisibility = (): void => {
    this.updateRunning();
  };

  private updateRunning(): void {
    const shouldRun = !document.hidden && this.visible && !this.reduced;
    if (shouldRun && !this.running) this.start();
    else if (!shouldRun && this.running) this.stop();
  }

  private start(): void {
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private scheduleBlink(now: number): void {
    // 6~10초 랜덤 간격 — 살아있는 느낌의 핵심
    this.nextBlink = now + 6 + Math.random() * 4;
  }

  private updateBlink(t: number): void {
    if (this.blinkStart < 0 && t >= this.nextBlink) this.blinkStart = t;
    if (this.blinkStart >= 0) {
      const BLINK_DUR = 0.12;
      const p = (t - this.blinkStart) / BLINK_DUR;
      // 0→1: 감김(1→0.05), 1→2: 복원
      const s =
        p >= 2 ? 1 : p <= 1 ? 1 - 0.95 * p : 0.05 + 0.95 * (p - 1);
      for (const eye of this.owl.eyes) eye.scale.y = Math.max(0.05, s);
      if (p >= 2) {
        this.blinkStart = -1;
        this.scheduleBlink(t);
      }
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    const g = this.owl.group;

    // Y축 상시 회전 + 부유
    g.rotation.y = t * 0.12;
    g.position.y = (this.variant.offsetY ?? 0) + Math.sin(t * 0.6) * 0.06;

    // 마우스 패럴랙스 (±0.18 rad, lerp 0.05)
    const targetX = (this.variant.tiltX ?? 0) + this.mouse.y * 0.18;
    const targetZ = -this.mouse.x * 0.18;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
    g.rotation.z += (targetZ - g.rotation.z) * 0.05;

    // 스크롤 시 카메라가 약간 물러남 (z: base → base+0.6)
    const scrollP = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    this.camera.position.z = this.baseZ + scrollP * 0.6;

    this.updateBlink(t);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
  }
}
