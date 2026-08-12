// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import { mountFooter } from '../components/footer';
import { mountNav } from '../components/nav';
import { api } from '../lib/api';
import { countUp } from '../lib/format';
import { mountOwl } from '../three/mount';

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

/** 동아리방 카드 — 마우스 따라 기울어지는 3D 틸트 + 글레어 */
function initRoomTilt(): void {
  const card = document.getElementById('roomCard');
  if (!card) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  const MAX = 6; // deg
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * MAX;
    const ry = (px - 0.5) * MAX;
    card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
  });
}

async function loadStats(): Promise<void> {
  try {
    const stats = await api.stats();
    const members = document.getElementById('infraMembers');
    if (members) countUp(members, stats.members);
    const gen = document.getElementById('infraGen');
    if (gen) gen.textContent = String(stats.generation);
  } catch {
    const members = document.getElementById('infraMembers');
    if (members) members.textContent = '35'; // API 다운 시 확정값 표기
  }
}

mountNav();
mountFooter();
reveal();
initRoomTilt();
void loadStats();
void mountOwl('about');
