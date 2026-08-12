#!/usr/bin/env node
/* ============================================================
   S.OWL — GitHub 업로드 스크립트
   실행:  pnpm push  ·  런처 핫키 [g]
          pnpm push "커밋 메시지"  (메시지 생략 시 날짜로 자동 생성)
   동작:  변경사항 스테이징 → 커밋 → push
          원격(origin)이 없으면 gh CLI로 비공개 저장소를 만들어 연결
   ============================================================ */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_NAME = 'sowl-website';

/* ---------- ANSI 팔레트 (launcher.mjs와 동일한 색) ---------- */
const esc = (s) => `\x1b[${s}`;
const fg = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return esc(`38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`);
};
const C = {
  cyan: fg('#22d3ee'), cyanHi: fg('#67e8f9'), lime: fg('#a3e635'),
  violet: fg('#a78bfa'), danger: fg('#fb7185'),
  text: fg('#e8eef7'), muted: fg('#9aa7b8'), dim: fg('#64748b'), faint: fg('#475569'),
  bold: esc('1m'), r: esc('0m'),
};

const ok = (msg, info = '') => console.log(`  ${C.lime}✔${C.r} ${C.text}${msg}${C.r} ${C.faint}${info}${C.r}`);
const bad = (msg) => console.log(`  ${C.danger}✖ ${msg}${C.r}`);
const note = (msg) => console.log(`  ${C.muted}${msg}${C.r}`);

/* ---------- 명령 실행 (출력 캡처, 실패해도 throw 하지 않는다) ---------- */
function sh(cmd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: ROOT, shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let out = '';
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { out += d.toString(); });
    child.on('error', (e) => resolve({ code: 1, out: e.message }));
    child.on('exit', (code) => resolve({ code: code ?? 1, out: out.trim() }));
  });
}
const lastLines = (out, n = 3) => out.split('\n').filter(Boolean).slice(-n).join(' · ');

/* ---------- 원격 저장소 URL을 보기 좋은 https 형태로 ---------- */
function prettyUrl(remote) {
  return remote
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
}

/** GitHub 업로드. 성공하면 true. (런처에서 import 해서 쓴다) */
export async function gitPush(message) {
  console.log(`  ${C.violet}${C.bold}↑ GitHub 업로드${C.r}`);

  if ((await sh('git rev-parse --is-inside-work-tree')).code !== 0) {
    bad('git 저장소가 아닙니다. 프로젝트 루트에서 "git init" 후 다시 실행해 주세요.');
    return false;
  }

  /* 1. 변경사항 커밋 */
  await sh('git add -A');
  const dirty = (await sh('git status --porcelain')).out;
  if (dirty) {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const msg = (message || `사이트 업데이트 — ${stamp}`).replace(/"/g, "'");
    const commit = await sh(`git commit -m "${msg}"`);
    if (commit.code !== 0) {
      bad(`커밋 실패 — ${lastLines(commit.out)}`);
      return false;
    }
    ok('변경사항 커밋', `${dirty.split('\n').length}개 파일 · "${msg}"`);
  } else {
    note('새로 커밋할 변경사항 없음 — 밀린 커밋만 푸시합니다.');
  }

  /* 2. 원격(origin)이 없으면 gh CLI로 저장소를 만들어 연결 */
  const remote = await sh('git remote get-url origin');
  if (remote.code !== 0) {
    if ((await sh('gh --version')).code !== 0) {
      bad('GitHub 원격 저장소가 아직 없고, gh CLI도 설치되어 있지 않습니다.');
      note(`설치:   winget install --id GitHub.cli`);
      note(`로그인: gh auth login   (설치 후 새 터미널에서 한 번만)`);
      note('그다음 다시 [g] 를 누르면 저장소 생성부터 업로드까지 자동으로 됩니다.');
      return false;
    }
    if ((await sh('gh auth status')).code !== 0) {
      bad('gh CLI 로그인이 필요합니다.');
      note('터미널에서 "gh auth login" 을 실행해 GitHub 계정으로 로그인해 주세요.');
      return false;
    }
    const create = await sh(`gh repo create ${REPO_NAME} --private --source=. --remote=origin --push`);
    if (create.code !== 0) {
      bad(`저장소 생성 실패 — ${lastLines(create.out)}`);
      return false;
    }
    const url = prettyUrl((await sh('git remote get-url origin')).out);
    ok('비공개 저장소 생성 + 업로드 완료', url);
    return true;
  }

  /* 3. push */
  const branch = (await sh('git rev-parse --abbrev-ref HEAD')).out || 'main';
  const push = await sh(`git push -u origin ${branch}`);
  if (push.code !== 0) {
    bad(`푸시 실패 — ${lastLines(push.out)}`);
    if (/rejected|non-fast-forward|fetch first/i.test(push.out)) {
      note('원격에 더 새로운 커밋이 있습니다. "git pull --rebase" 후 다시 시도해 주세요.');
    }
    return false;
  }
  const head = (await sh('git log -1 --format=%h')).out;
  ok('GitHub 업로드 완료', `${prettyUrl(remote.out)} (${branch} · ${head})`);
  return true;
}

/* ---------- 단독 실행 (pnpm push) ---------- */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const message = process.argv.slice(2).join(' ').trim();
  console.log('');
  gitPush(message || undefined).then((success) => {
    console.log('');
    process.exit(success ? 0 : 1);
  });
}
