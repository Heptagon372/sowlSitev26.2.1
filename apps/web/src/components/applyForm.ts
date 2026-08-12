import {
  DAY_OPTIONS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_DESC,
  INTEREST_OPTIONS,
  type ApplicationInput,
  type ExperienceLevel,
  type RecruitInfo,
  type SessionUser,
} from '@sowl/shared';
import { SITE } from '../config';
import { ApiError, api } from '../lib/api';
import { fmtPhone, fmtStudentId, highlightJSON } from '../lib/format';
import { RULES, REQUIRED_KEYS, emptyState, type FormState, type RuleKey } from '../lib/validators';
import { toast } from './toast';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/** 지원서 폼 + JSON 프리뷰 + 진행률 + 제출 흐름 전체를 담당 */
export function initApplyForm(recruit: RecruitInfo | null, me: SessionUser | null = null): void {
  const formNullable = $<HTMLFormElement>('#form');
  if (!formNullable) return;
  const form: HTMLFormElement = formNullable;

  const state: FormState = emptyState();
  let lastPayload: ApplicationInput | null = null;
  const generation = recruit?.generation ?? SITE.generationFallback;
  const phase = recruit?.phase ?? 'open';
  const serverDown = recruit === null;

  /* ---------- 동적 컨트롤 ---------- */
  const chips = $('#chips')!;
  for (const v of INTEREST_OPTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = v;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      state.interests = on ? state.interests.filter((x) => x !== v) : [...state.interests, v];
      clearError('interests');
      sync();
    });
    chips.appendChild(b);
  }

  const seg = $('#seg')!;
  for (const lv of EXPERIENCE_LEVELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `${lv}<b>${EXPERIENCE_LEVEL_DESC[lv]}</b>`;
    b.addEventListener('click', () => {
      $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      state.level = lv;
      clearError('level');
      sync();
    });
    seg.appendChild(b);
  }

  const days = $('#days')!;
  for (const d of DAY_OPTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = d;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `${d}요일`);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      state.days = on ? state.days.filter((x) => x !== d) : [...state.days, d];
      sync();
    });
    days.appendChild(b);
  }

  /* ---------- 입력 바인딩 ---------- */
  type TextKey =
    | 'name'
    | 'studentId'
    | 'department'
    | 'grade'
    | 'phone'
    | 'email'
    | 'motivation'
    | 'project';
  const inputMap: Record<string, TextKey> = {
    'f-name': 'name',
    'f-sid': 'studentId',
    'f-dept': 'department',
    'f-grade': 'grade',
    'f-phone': 'phone',
    'f-email': 'email',
    'f-mot': 'motivation',
    'f-proj': 'project',
  };
  for (const [id, key] of Object.entries(inputMap)) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) continue;
    const handler = () => {
      if (id === 'f-phone') el.value = fmtPhone(el.value);
      if (id === 'f-sid') el.value = fmtStudentId(el.value);
      state[key] = el.value.trim();
      if (id === 'f-mot') {
        const n = state.motivation.length;
        const c = $('#motCount')!;
        c.textContent = `${n} / 30자`;
        c.classList.toggle('ok', n >= 30);
      }
      if (key !== 'project') clearError(key);
      sync();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    el.addEventListener('blur', () => {
      if (key !== 'project' && state[key].length > 0) {
        validate(key);
      }
    });
  }
  const priv = $<HTMLInputElement>('#f-priv')!;
  priv.addEventListener('change', () => {
    state.privacy = priv.checked;
    clearError('privacy');
    sync();
  });

  /* ---------- 로그인 상태면 이름·학번·이메일 자동 채움 (②§3) ---------- */
  if (me) {
    const fill = (id: string, key: TextKey, value: string | null) => {
      if (!value) return;
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.value) {
        el.value = value;
        state[key] = value;
      }
    };
    fill('f-name', 'name', me.name);
    fill('f-sid', 'studentId', me.studentId);
    fill('f-email', 'email', me.email);
    const note = document.getElementById('autofillNote');
    if (note) note.hidden = false;
  }

  /* ---------- 검증 ---------- */
  function fieldEl(key: string): HTMLElement | null {
    return $(`[data-f="${key}"]`);
  }
  function validate(key: RuleKey): boolean {
    const ok = RULES[key](state);
    const f = fieldEl(key);
    if (f) {
      f.classList.toggle('bad', !ok);
      const c = $<HTMLElement>('.ctl', f);
      if (c) c.setAttribute('aria-invalid', String(!ok));
    }
    return ok;
  }
  function clearError(key: RuleKey): void {
    const f = fieldEl(key);
    if (f && f.classList.contains('bad') && RULES[key](state)) validate(key);
  }
  function validateAll(): RuleKey | null {
    let first: RuleKey | null = null;
    for (const k of REQUIRED_KEYS) {
      if (!validate(k) && !first) first = k;
    }
    return first;
  }

  /* ---------- 페이로드 + JSON 프리뷰 + 진행률 ---------- */
  function payload(): ApplicationInput {
    return {
      applicant: {
        name: state.name,
        studentId: state.studentId,
        department: state.department,
        grade: state.grade,
        phone: state.phone,
        email: state.email,
      },
      interests: state.interests,
      experience: (state.level || '입문') as ExperienceLevel,
      availableDays: state.days,
      motivation: state.motivation,
      wantToBuild: state.project || null,
      agreedToPrivacyPolicy: true,
    };
  }

  /** 프리뷰 전용 — 빈 값은 null로 보여준다 */
  function previewPayload(): Record<string, unknown> {
    return {
      applicant: {
        name: state.name || null,
        studentId: state.studentId || null,
        department: state.department || null,
        grade: state.grade || null,
        phone: state.phone || null,
        email: state.email || null,
      },
      interests: state.interests,
      experience: state.level || null,
      availableDays: state.days,
      motivation: state.motivation || null,
      wantToBuild: state.project || null,
      agreedToPrivacyPolicy: state.privacy,
      meta: { club: 'SLEEPY OWL', generation },
    };
  }

  function sync(): void {
    const json = $('#json');
    if (json) json.innerHTML = highlightJSON(previewPayload());
    const done = REQUIRED_KEYS.filter((k) => RULES[k](state)).length;
    const pct = Math.round((done / REQUIRED_KEYS.length) * 100);
    const bar = $('#progBar');
    const num = $('#progNum');
    if (bar) bar.style.width = `${pct}%`;
    if (num) num.textContent = `${pct}%`;
  }

  /* ---------- 부팅 로그 타이핑 ---------- */
  function bootLog(): void {
    const box = $('#boot');
    if (!box) return;
    const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
    const end = recruit ? new Date(recruit.endsAt).getTime() : Date.now();
    const dday = Math.max(0, Math.round((midnight(end) - midnight(Date.now())) / 86_400_000));
    const statusText =
      phase === 'open' ? `진행 중 · D-${dday}` : phase === 'before' ? '준비 중' : '마감';
    const lines = [
      { c: 'p', t: '$ ssh apply@sleepy-owl.skhu.ac.kr' },
      {
        c: '',
        t: serverDown
          ? '  Connecting to S.OWL recruit server ... offline (fallback mode)'
          : '  Connecting to S.OWL recruit server ... connected',
      },
      { c: 'p', t: `$ sowl init --generation ${generation}` },
      { c: 'ok', t: `  ✔ ${generation}기 신입 부원 모집 ${statusText}` },
      { c: 'w', t: '$ ./apply.sh --start' },
    ];
    if (REDUCED) {
      box.innerHTML =
        lines.map((l) => `<div class="${l.c}">${l.t}</div>`).join('') +
        '<span class="caret"></span>';
      return;
    }
    let li = 0;
    const nextLine = () => {
      if (li >= lines.length) {
        const c = document.createElement('span');
        c.className = 'caret';
        box.appendChild(c);
        return;
      }
      const L = lines[li++];
      const div = document.createElement('div');
      div.className = L.c;
      box.appendChild(div);
      let ci = 0;
      const type = () => {
        div.textContent = L.t.slice(0, ++ci);
        if (ci < L.t.length) window.setTimeout(type, 11);
        else window.setTimeout(nextLine, 140);
      };
      type();
    };
    nextLine();
  }

  /* ---------- phase별 분기 ---------- */
  const submitBtn = $<HTMLButtonElement>('#submitBtn')!;
  const submitLabel = $('#submitLabel')!;
  const banner = $('#closedBanner')!;
  const gform = `<a href="${recruit?.googleFormUrl ?? SITE.googleFormUrl}" target="_blank" rel="noopener noreferrer">구글폼으로 지원하기 ↗</a>`;

  if (serverDown) {
    banner.classList.add('on');
    banner.innerHTML = `접수 서버에 연결할 수 없습니다. 작성한 내용은 사라지지 않으니 잠시 후 다시 제출하거나, ${gform} 를 이용해 주세요.`;
  } else if (phase === 'before') {
    submitBtn.disabled = true;
    submitLabel.textContent = '모집 시작 전입니다';
  } else if (phase === 'closed') {
    submitBtn.disabled = true;
    submitLabel.textContent = '모집이 마감되었습니다';
    banner.classList.add('on');
    banner.innerHTML = `이번 기수 모집이 마감되었습니다. 다음 모집 소식은 <a href="${SITE.instagram}" target="_blank" rel="noopener noreferrer">인스타그램 @skhu_s.owl ↗</a> 에서 가장 먼저 알려드립니다.`;
  }

  /* ---------- 제출 ---------- */
  function summaryText(d: ApplicationInput): string {
    return [
      `[ SLEEPY OWL ${generation}기 지원서 ]`,
      `이름: ${d.applicant.name}`,
      `학번: ${d.applicant.studentId}`,
      `학과: ${d.applicant.department} / ${d.applicant.grade}`,
      `연락처: ${d.applicant.phone}`,
      `이메일: ${d.applicant.email}`,
      `관심 분야: ${d.interests.join(', ')}`,
      `개발 경험: ${d.experience}`,
      `활동 가능 요일: ${d.availableDays.length ? d.availableDays.join(', ') : '-'}`,
      '',
      '[지원 동기]',
      d.motivation,
      '',
      '[만들어 보고 싶은 것]',
      d.wantToBuild || '-',
    ].join('\n');
  }

  function showDone(data: ApplicationInput, result: { updated: boolean; sent: boolean }): void {
    form.style.display = 'none';
    const boot = $('#boot');
    if (boot) boot.style.display = 'none';
    const d = $('#done')!;
    d.classList.add('on');

    const size = (new Blob([JSON.stringify(data)]).size / 1024).toFixed(1);
    const postLine = result.sent
      ? result.updated
        ? 'POST /api/applications ..... 200 OK (updated)'
        : 'POST /api/applications ..... 201 Created'
      : 'local build ................ done';
    const log = [
      '<span class="ok">$</span> <span class="w">./apply.sh --submit</span>',
      '<span class="c">[ok]</span> validating fields ......... passed',
      `<span class="c">[ok]</span> building application.json .. ${size} KB`,
      `<span class="c">[ok]</span> ${postLine}`,
      '',
      `<span class="m">[==]</span> ${data.applicant.name} (${data.applicant.studentId}) · ${data.applicant.department} ${data.applicant.grade}`,
      `<span class="m">[==]</span> 관심 분야: ${data.interests.join(', ')}`,
      `<span class="m">[==]</span> 개발 경험: ${data.experience}`,
      '',
      `<span class="ok">[**] ${
        result.sent
          ? result.updated
            ? '기존 지원서를 갱신했습니다.'
            : '접수가 완료되었습니다.'
          : '지원서 작성이 완료되었습니다.'
      }</span>`,
    ].join('\n');
    $('#doneLog')!.innerHTML = log;

    $('#doneMsg')!.textContent = result.sent
      ? `검토 후 마감일로부터 1주 이내에 ${data.applicant.email} 또는 문자로 개별 연락드립니다.`
      : '서버 접수에 실패했습니다. 아래 "지원서 복사하기"를 누른 뒤 구글폼에 붙여넣어 제출해 주세요. 그래야 최종 접수가 완료됩니다.';

    // §3 — 제출 성공 화면의 계정 상태별 분기
    const account = $('#doneAccount');
    if (account && result.sent) {
      if (!me) {
        account.innerHTML = `계정을 만들어두면 합격 후 바로 회원 공간을 쓸 수 있어요
          <a class="btn btn--line" href="/signup.html" style="margin-left:10px">회원가입 →</a>`;
        account.classList.add('on');
      } else if (me.role === 'GUEST') {
        account.textContent =
          '지원서가 접수되었습니다. 합격하면 관리자가 학번을 등록해 회원으로 전환해 드립니다.';
        account.classList.add('on');
      }
    }

    d.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (phase !== 'open' && !serverDown) {
      toast(phase === 'before' ? '아직 모집 시작 전입니다.' : '모집이 마감되었습니다.');
      return;
    }
    const bad = validateAll();
    if (bad) {
      const f = fieldEl(bad);
      f?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      const c = f?.querySelector<HTMLElement>('.ctl') ?? f?.querySelector<HTMLElement>('button');
      if (c) window.setTimeout(() => c.focus({ preventScroll: true }), REDUCED ? 0 : 420);
      toast('입력하지 않은 항목이 있습니다.');
      return;
    }

    const before = submitLabel.textContent ?? '지원서 제출하기';
    submitBtn.disabled = true;
    submitLabel.textContent = '제출하는 중...';

    const data = payload();
    lastPayload = data;
    try {
      const result = await api.submitApplication(data);
      showDone(data, { updated: result.updated, sent: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RECRUIT_CLOSED') {
        toast(err.message);
        banner.classList.add('on');
        banner.innerHTML = `${err.message} 다음 모집 소식은 <a href="${SITE.instagram}" target="_blank" rel="noopener noreferrer">인스타그램 ↗</a> 에서 알려드립니다.`;
      } else if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        toast(err.message);
      } else if (err instanceof ApiError && err.code !== 'NETWORK') {
        toast(`제출 실패: ${err.message}`);
      } else {
        // 서버 다운 — 입력값을 잃지 않은 채 구글폼 안내
        toast('서버에 연결할 수 없어 로컬로 저장했습니다.');
        showDone(data, { updated: false, sent: false });
      }
    } finally {
      submitBtn.disabled = phase !== 'open' && !serverDown;
      submitLabel.textContent = before;
    }
  });

  /* ---------- 완료 화면 버튼 ---------- */
  $('#copyBtn')?.addEventListener('click', async () => {
    if (!lastPayload) return;
    const txt = summaryText(lastPayload);
    try {
      await navigator.clipboard.writeText(txt);
      toast('지원서 내용을 복사했습니다.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('지원서 내용을 복사했습니다.');
      } catch {
        toast('복사에 실패했습니다. 직접 선택해 주세요.');
      }
      document.body.removeChild(ta);
    }
  });

  $('#dlBtn')?.addEventListener('click', () => {
    if (!lastPayload) return;
    const blob = new Blob([JSON.stringify(lastPayload, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sowl-application-${lastPayload.applicant.studentId || 'draft'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#againBtn')?.addEventListener('click', () => {
    $('#done')?.classList.remove('on');
    form.style.display = '';
    const boot = $('#boot');
    if (boot) boot.style.display = '';
    form.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  });

  const gformDone = $<HTMLAnchorElement>('#gformDone');
  if (gformDone) gformDone.href = recruit?.googleFormUrl ?? SITE.googleFormUrl;

  /* ---------- 초기화 ---------- */
  bootLog();
  sync();
}
