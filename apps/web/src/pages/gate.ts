// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import { mountNav } from '../components/nav';
import { api } from '../lib/api';
import { mountOwl } from '../three/mount';

/**
 * §6 — /member/* 를 URL로 직접 열었을 때 리다이렉트되는 전체 화면 게이트.
 * ?from=<경로> 를 기억해 두었다가, 이미 회원이면 그리로 되돌려 보낸다.
 */
async function main(): Promise<void> {
  mountNav();
  void mountOwl('apply');

  const from = new URLSearchParams(location.search).get('from');

  const me = await api.auth.me().catch(() => null);
  if (me && me.role !== 'GUEST') {
    // 이미 회원인데 게이트로 온 경우 — 원래 가려던 곳으로
    location.replace(from && from.startsWith('/member/') ? from : '/member/index.html');
    return;
  }

  const login = document.getElementById('gateLogin');
  if (login) {
    if (!me) {
      const next = from && from.startsWith('/') ? `?next=${encodeURIComponent(from)}` : '';
      login.innerHTML = `이미 부원이신가요? <a href="/login.html${next}">로그인</a>`;
    } else {
      login.textContent = `${me.name}님은 아직 비회원입니다. 합격 후 관리자가 학번을 등록하면 열려요.`;
    }
  }

  void api
    .recruit()
    .then((info) => {
      const el = document.getElementById('gateDday');
      if (!el) return;
      if (info.phase === 'open') {
        const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
        const d = Math.max(
          0,
          Math.round(
            (midnight(new Date(info.endsAt).getTime()) - midnight(Date.now())) / 86_400_000,
          ),
        );
        el.textContent = `${info.generation}기 신입 부원을 모집하고 있습니다. D-${d}`;
      } else if (info.phase === 'before') {
        el.textContent = `${info.generation}기 모집이 곧 시작됩니다.`;
      } else {
        el.textContent = '다음 기수 모집을 기다려 주세요.';
      }
    })
    .catch(() => undefined);
}

void main();
