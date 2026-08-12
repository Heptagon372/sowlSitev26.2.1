import * as THREE from 'three';

/* 절차적 네온 와이어프레임 부엉이 — 외부 모델 파일 없이 코드로 만든다 */

const CYAN = 0x22d3ee;
const CYAN_HI = 0x67e8f9;
const MAGENTA = 0xf472d0;
const WHITE = 0xffffff;

export interface OwlRefs {
  group: THREE.Group;
  eyes: THREE.Object3D[];
  materials: { lines: THREE.LineBasicMaterial[]; points: THREE.PointsMaterial[] };
}

/** 지오메트리 표면에서 균등하게 점을 샘플링한다 (Points 레이어용) */
function sampleSurface(geo: THREE.BufferGeometry, count: number): Float32Array {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute('position') as THREE.BufferAttribute;
  const triCount = pos.count / 3;
  const out = new Float32Array(count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const t = Math.floor(Math.random() * triCount) * 3;
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    out[i * 3] = a.x + (b.x - a.x) * u + (c.x - a.x) * v;
    out[i * 3 + 1] = a.y + (b.y - a.y) * u + (c.y - a.y) * v;
    out[i * 3 + 2] = a.z + (b.z - a.z) * u + (c.z - a.z) * v;
  }
  return out;
}

/** 각 파트를 두 겹(와이어프레임 + 표면 점)으로 렌더링해 '데이터로 그려진 부엉이' 인상을 만든다 */
function makePart(
  geo: THREE.BufferGeometry,
  color: number,
  refs: OwlRefs,
  opts: { points?: number; pointColor?: number; lineOpacity?: number } = {},
): THREE.Group {
  const g = new THREE.Group();

  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: opts.lineOpacity ?? 0.55,
  });
  refs.materials.lines.push(lineMat);
  g.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo), lineMat));

  const pointCount = opts.points ?? 0;
  if (pointCount > 0) {
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(sampleSurface(geo, pointCount), 3));
    const pMat = new THREE.PointsMaterial({
      color: opts.pointColor ?? color,
      size: 0.02,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    refs.materials.points.push(pMat);
    g.add(new THREE.Points(pGeo, pMat));
  }
  return g;
}

export function buildOwl(): OwlRefs {
  const refs: OwlRefs = {
    group: new THREE.Group(),
    eyes: [],
    materials: { lines: [], points: [] },
  };
  const owl = refs.group;

  // 몸통 — 살짝 세로로 늘린 이코사헤드론
  const body = makePart(new THREE.IcosahedronGeometry(1.15, 1), CYAN, refs, { points: 1200 });
  body.scale.y = 1.25;
  body.position.y = -0.55;
  owl.add(body);

  // 머리
  const head = makePart(new THREE.IcosahedronGeometry(0.78, 1), CYAN, refs, { points: 800 });
  head.position.y = 1.05;
  owl.add(head);

  // 눈 — 정면을 향한 토러스 링 2개 (깜빡임 대상)
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.add(makePart(new THREE.TorusGeometry(0.22, 0.035, 8, 24), CYAN_HI, refs, { points: 120, lineOpacity: 0.9 }));
    // 동공 — 가장 밝은 지점 (흰색 발광)
    const pupilMat = new THREE.PointsMaterial({
      color: WHITE,
      size: 0.09,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    refs.materials.points.push(pupilMat);
    const pupilGeo = new THREE.BufferGeometry();
    pupilGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.02]), 3));
    eye.add(new THREE.Points(pupilGeo, pupilMat));
    const pupilShell = makePart(new THREE.SphereGeometry(0.055, 8, 8), WHITE, refs, {
      lineOpacity: 0.8,
    });
    eye.add(pupilShell);

    eye.position.set(0.3 * side, 1.12, 0.62);
    refs.eyes.push(eye);
    owl.add(eye);
  }

  // 부리 — 눈 사이 아래, 마젠타
  const beak = makePart(new THREE.ConeGeometry(0.14, 0.26, 4), MAGENTA, refs, {
    points: 60,
    lineOpacity: 0.8,
  });
  beak.position.set(0, 0.82, 0.68);
  beak.rotation.x = Math.PI / 2.4;
  owl.add(beak);

  // 귀깃 — 머리 위 2개, 마젠타
  for (const side of [-1, 1]) {
    const tuft = makePart(new THREE.ConeGeometry(0.16, 0.5, 5), MAGENTA, refs, { points: 70 });
    tuft.position.set(0.42 * side, 1.78, 0);
    tuft.rotation.z = -0.35 * side;
    owl.add(tuft);
  }

  // 날개 — 눌러 만든 이코사헤드론 2개, 몸통 양옆
  for (const side of [-1, 1]) {
    const wing = makePart(new THREE.IcosahedronGeometry(0.62, 1), CYAN, refs, { points: 380 });
    wing.scale.set(0.42, 1.35, 0.75);
    wing.position.set(1.12 * side, -0.4, 0);
    wing.rotation.z = 0.3 * side;
    owl.add(wing);
  }

  return refs;
}
