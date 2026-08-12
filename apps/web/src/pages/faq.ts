// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import { mountFooter } from '../components/footer';
import { mountNav } from '../components/nav';
import { mountOwl } from '../three/mount';
import { SITE } from '../config';

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

mountNav();
mountFooter();
reveal();
void mountOwl('faq');

for (const id of ['faqMail', 'faqMailBtn']) {
  const a = document.getElementById(id) as HTMLAnchorElement | null;
  if (a) {
    a.href = `mailto:${SITE.email}`;
    if (id === 'faqMail') a.textContent = SITE.email;
  }
}
