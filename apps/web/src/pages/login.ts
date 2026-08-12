// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import { mountNav } from '../components/nav';
import { ApiError, api } from '../lib/api';
import { fmtStudentId } from '../lib/format';
import { mountOwl } from '../three/mount';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);

function main(): void {
  mountNav();
  void mountOwl('faq');

  const form = $<HTMLFormElement>('#form')!;
  const sid = $<HTMLInputElement>('#f-sid')!;
  const pw = $<HTMLInputElement>('#f-pw')!;
  const err = $('#err')!;
  const submitBtn = $<HTMLButtonElement>('#submitBtn')!;
  const submitLabel = $('#submitLabel')!;

  sid.addEventListener('input', () => {
    sid.value = fmtStudentId(sid.value);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    err.classList.remove('on');

    void (async () => {
      submitBtn.disabled = true;
      submitLabel.textContent = '확인하는 중...';
      try {
        const user = await api.auth.login({ studentId: sid.value, password: pw.value });
        // 로그인 후 이동 — ?next= 우선, 없으면 등급별 기본 페이지
        const next = new URLSearchParams(location.search).get('next');
        if (next && next.startsWith('/')) {
          location.href = next;
        } else if (user.role === 'ADMIN') {
          location.href = '/admin/index.html';
        } else if (user.role === 'MEMBER') {
          location.href = '/member/index.html';
        } else {
          location.href = '/';
        }
      } catch (e2) {
        if (e2 instanceof ApiError && e2.code === 'ACCOUNT_LOCKED') {
          err.textContent = e2.message;
        } else if (e2 instanceof ApiError && e2.statusCode === 401) {
          err.textContent = '학번 또는 비밀번호가 올바르지 않습니다.';
        } else if (e2 instanceof ApiError && e2.code === 'RATE_LIMITED') {
          err.textContent = '시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
        } else {
          err.textContent = '서버에 연결할 수 없습니다.';
        }
        err.classList.add('on');
        submitBtn.disabled = false;
        submitLabel.textContent = '로그인';
      }
    })();
  });
}

main();
