// CSS는 HTML <head>의 <link>가 싣는다 — 목록은 tools/gen-pages.mjs의 PUBLIC_CSS
import { USER_VALIDATION, VALIDATION, checkPassword } from '@sowl/shared';
import { mountNav } from '../components/nav';
import { toast } from '../components/toast';
import { ApiError, api } from '../lib/api';
import { fmtStudentId } from '../lib/format';
import { mountOwl } from '../three/mount';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);

function field(key: string): HTMLElement | null {
  return $(`[data-f="${key}"]`);
}
function setBad(key: string, bad: boolean): void {
  field(key)?.classList.toggle('bad', bad);
}

/** 강도 미터 — 약함/보통/강함 (규칙과 무관한 참고용 표시) */
function strength(pw: string): { pct: number; label: string; color: string } {
  if (!pw) return { pct: 0, label: '-', color: 'var(--danger)' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (checkPassword(pw).specialOk) score += 1;
  if (score <= 2) return { pct: 33, label: '약함', color: 'var(--danger)' };
  if (score <= 3) return { pct: 66, label: '보통', color: '#fbbf24' };
  return { pct: 100, label: '강함', color: 'var(--lime)' };
}

function main(): void {
  mountNav();
  void mountOwl('faq'); // 좌측 하단 작은 부엉이

  const form = $<HTMLFormElement>('#form')!;
  const name = $<HTMLInputElement>('#f-name')!;
  const sid = $<HTMLInputElement>('#f-sid')!;
  const pw = $<HTMLInputElement>('#f-pw')!;
  const pw2 = $<HTMLInputElement>('#f-pw2')!;
  const email = $<HTMLInputElement>('#f-email')!;
  const terms = $<HTMLInputElement>('#f-terms')!;
  const err = $('#err')!;
  const submitBtn = $<HTMLButtonElement>('#submitBtn')!;
  const submitLabel = $('#submitLabel')!;

  sid.addEventListener('input', () => {
    sid.value = fmtStudentId(sid.value).slice(0, 9); // 학번 = 정확히 9자리
    setBad('studentId', false);
  });
  name.addEventListener('input', () => setBad('name', false));
  pw2.addEventListener('input', () => setBad('passwordConfirm', false));
  email.addEventListener('input', () => setBad('email', false));
  terms.addEventListener('change', () => setBad('terms', false));

  // 비밀번호 규칙 체크리스트(✓ 8자 ✓ 특수문자) + 강도 미터 + 학번 포함 경고
  const update = () => {
    const c = checkPassword(pw.value);
    $('#ckLen')!.classList.toggle('ok', c.lengthOk);
    $('#ckSp')!.classList.toggle('ok', c.specialOk);
    const s = strength(pw.value);
    const bar = $('#pwBar')!;
    bar.style.width = `${s.pct}%`;
    bar.style.background = s.color;
    $('#pwLabel')!.textContent = s.label;
    // 학번 포함은 경고만 (차단 아님)
    $('#pwWarn')!.classList.toggle(
      'on',
      sid.value.length >= 4 && pw.value.includes(sid.value),
    );
    if (c.ok) setBad('password', false);
  };
  pw.addEventListener('input', update);
  sid.addEventListener('input', update);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    err.classList.remove('on');

    const bad: string[] = [];
    if (!USER_VALIDATION.namePattern.test(name.value.trim())) bad.push('name');
    if (!USER_VALIDATION.studentIdPattern.test(sid.value)) bad.push('studentId');
    if (!checkPassword(pw.value).ok) bad.push('password');
    if (pw.value !== pw2.value) bad.push('passwordConfirm');
    if (email.value.trim() && !VALIDATION.emailPattern.test(email.value.trim()))
      bad.push('email');
    if (!terms.checked) bad.push('terms');
    ['name', 'studentId', 'password', 'passwordConfirm', 'email', 'terms'].forEach((k) =>
      setBad(k, bad.includes(k)),
    );
    if (bad.length) {
      toast('입력값을 다시 확인해 주세요.');
      return;
    }

    void (async () => {
      submitBtn.disabled = true;
      submitLabel.textContent = '가입하는 중...';
      try {
        const user = await api.auth.signup({
          name: name.value.trim(),
          studentId: sid.value,
          password: pw.value,
          email: email.value.trim() || null,
          agreedToTerms: true,
        });
        // §4-1 가입 완료 화면 — 등급별 분기
        form.style.display = 'none';
        $('#alt')!.style.display = 'none';
        const done = $('#done')!;
        done.classList.add('on');
        const btns = $('#doneBtns')!;
        if (user.role === 'GUEST') {
          $('#doneTitle')!.textContent = '가입 완료!';
          $('#doneMsg')!.innerHTML =
            '현재는 <b>비회원</b>입니다.<br />동아리 회원으로 승인되면 회원 공간이 열립니다.';
          btns.innerHTML = `
            <a class="btn btn--primary" href="/apply.html"><span class="ring" aria-hidden="true"></span><span class="inner"><span class="label">15기 지원하기</span></span></a>
            <a class="btn btn--line" href="/">홈으로</a>`;
        } else {
          $('#doneTitle')!.textContent = 'S.OWL 회원으로 확인되었습니다';
          $('#doneMsg')!.textContent = `${user.name}님, 환영합니다. 회원 공간이 열려 있어요.`;
          btns.innerHTML = `
            <a class="btn btn--primary" href="/member/index.html"><span class="ring" aria-hidden="true"></span><span class="inner"><span class="label">대시보드로 가기</span></span></a>`;
        }
      } catch (e2) {
        if (e2 instanceof ApiError && e2.code === 'STUDENT_ID_TAKEN') {
          // 형식은 맞으므로 필드 에러(자릿수 문구)는 띄우지 않는다
          err.innerHTML = '이미 가입된 학번입니다. <a href="/login.html" style="color:var(--cyan)">로그인</a>해 주세요.';
        } else {
          err.textContent =
            e2 instanceof ApiError ? e2.message : '가입에 실패했습니다. 잠시 후 다시 시도해 주세요.';
        }
        err.classList.add('on');
      } finally {
        submitBtn.disabled = false;
        submitLabel.textContent = '가입하기';
      }
    })();
  });
}

main();
