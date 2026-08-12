// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import { mountFooter } from '../components/footer';
import { mountNav } from '../components/nav';
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

/** 카드 클릭/엔터 시 상세 펼침 (아코디언) */
function initAccordion(): void {
  const cards = document.querySelectorAll<HTMLElement>('.act');
  const toggle = (card: HTMLElement) => {
    const open = card.getAttribute('aria-expanded') === 'true';
    cards.forEach((c) => {
      c.setAttribute('aria-expanded', 'false');
      c.classList.remove('spot');
    });
    card.setAttribute('aria-expanded', String(!open));
  };
  cards.forEach((card) => {
    card.addEventListener('click', () => toggle(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(card);
      }
    });
  });
}

/** 홈 활동 카드 딥링크(#seminar 등) — 해당 카드를 펼치고 화면 중앙으로 */
function openFromHash(): void {
  const card = document.getElementById(location.hash.slice(1));
  if (!card?.classList.contains('act')) return;
  document.querySelectorAll<HTMLElement>('.act').forEach((c) => {
    c.setAttribute('aria-expanded', 'false');
    c.classList.remove('spot');
  });
  card.setAttribute('aria-expanded', 'true');
  card.classList.add('spot');
  window.setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
}

mountNav();
mountFooter();
reveal();
initAccordion();
openFromHash();
window.addEventListener('hashchange', openFromHash);
void mountOwl('activities');
