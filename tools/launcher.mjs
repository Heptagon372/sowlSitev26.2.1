#!/usr/bin/env node
/* ============================================================
   S.OWL 개발 서버 구동기 — 풀 부트스트랩
   처음 클릭하는 PC에서도 알아서 다 한다:
     pnpm 탐지 → 의존성 설치 → .env 생성 → shared 빌드
     → Prisma Client 생성 → DB 기동 → 마이그레이션 → 시드
     → API·웹 기동
   실행:  pnpm dev  ·  pnpm sowl  ·  tools\sowl-server.bat (더블클릭)
   핫키:  [o] 브라우저 열기 · [r] api/web 재시작 · [s] 상태
          [g] GitHub 업로드 · [q] 종료
   ============================================================ */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { dirname, join } from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TTY = process.stdout.isTTY === true;
const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001/api';

/* ---------- ANSI 팔레트 (tokens.css와 동일한 색) ---------- */
const esc = (s) => `\x1b[${s}`;
const fg = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return esc(`38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`);
};
const C = {
  cyan: fg('#22d3ee'), cyanHi: fg('#67e8f9'), magenta: fg('#f472d0'),
  lime: fg('#a3e635'), violet: fg('#a78bfa'), danger: fg('#fb7185'),
  text: fg('#e8eef7'), muted: fg('#9aa7b8'), dim: fg('#64748b'), faint: fg('#475569'),
  bold: esc('1m'), r: esc('0m'),
};
const rule = () => console.log(`${C.faint}  ${'─'.repeat(56)}${C.r}`);

/* ---------- 배너 ---------- */
function banner() {
  if (TTY) process.stdout.write(esc('2J') + esc('H'));
  const owl = ['  ,___,  ', '  (o,o)  ', '  {`"\'}  ', '  -"-"-  '];
  const logo = [
    '███████╗    ██████╗ ██╗    ██╗██╗     ',
    '██╔════╝   ██╔═══██╗██║    ██║██║     ',
    '███████╗   ██║   ██║██║ █╗ ██║██║     ',
    '╚════██║   ██║   ██║██║███╗██║██║     ',
    '███████║██╗╚██████╔╝╚███╔███╔╝███████╗',
    '╚══════╝╚═╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝',
  ];
  const grad = [C.cyanHi, C.cyan, C.cyan, C.violet, C.violet, C.magenta];
  console.log('');
  for (let i = 0; i < logo.length; i++) {
    const owlPart = i >= 1 && i <= 4 ? `${C.magenta}${owl[i - 1]}${C.r}` : '         ';
    console.log(`  ${owlPart}${grad[i]}${logo[i]}${C.r}`);
  }
  console.log(`\n  ${C.dim}SLEEPY OWL — 성공회대학교 IT 동아리 · dev server launcher${C.r}`);
  console.log(`  ${C.faint}our code never sleeps ${C.cyan}zZ${C.r}\n`);
  rule();
}

/* ---------- pnpm 탐지 ----------
   더블클릭(Explorer) 환경에서는 PATH에 pnpm이 없을 수 있다.
   PATH → npm 글로벌 → pnpm 단독 설치 → corepack 순으로 찾는다.   */
let PNPM = 'pnpm';
function resolvePnpm() {
  const probe = (cmd) => spawnSync(cmd, { shell: true, encoding: 'utf8' }).status === 0;
  if (probe('pnpm --version')) return 'pnpm';

  const candidates =
    process.platform === 'win32'
      ? [
          join(process.env.APPDATA ?? '', 'npm', 'pnpm.cmd'),
          join(process.env.LOCALAPPDATA ?? '', 'pnpm', 'pnpm.exe'),
        ]
      : ['/usr/local/bin/pnpm', join(os.homedir(), '.local/share/pnpm/pnpm')];
  for (const p of candidates) {
    if (existsSync(p) && probe(`"${p}" --version`)) return `"${p}"`;
  }

  // Node에 동봉된 corepack으로 마지막 시도 (필요 시 pnpm을 자동으로 받아온다)
  if (probe('corepack --version')) {
    process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = '0';
    if (probe('corepack pnpm --version')) return 'corepack pnpm';
  }
  throw new Error('pnpm을 찾지 못했습니다. "npm install -g pnpm" 후 다시 실행해 주세요.');
}

/* ---------- 자식 프로세스 ---------- */
const children = new Map(); // name → { child, buffer[] }
let streaming = false;
let shuttingDown = false;

const SERVICE_COLOR = { db: C.lime, api: C.magenta, web: C.cyan };
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function pushLog(name, chunk) {
  const clean = chunk
    .toString()
    .replace(/\x1b\[[23]J|\x1b\[H/g, '') // tsc watch의 화면 지우기 무력화
    .replace(/\r/g, '');
  for (const line of clean.split('\n')) {
    if (!line.trim()) continue;
    const entry = children.get(name);
    if (entry) {
      entry.buffer.push(line);
      if (entry.buffer.length > 40) entry.buffer.shift();
    }
    if (streaming) {
      console.log(`  ${SERVICE_COLOR[name] ?? C.dim}${name.padEnd(3)}${C.r} ${C.faint}│${C.r} ${C.muted}${stripAnsi(line).slice(0, 160)}${C.r}`);
    }
  }
}

function launch(name, cmdString, cwd) {
  const child = spawn(cmdString, {
    cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  children.set(name, { child, buffer: [] });
  child.stdout?.on('data', (d) => pushLog(name, d));
  child.stderr?.on('data', (d) => pushLog(name, d));
  child.on('exit', (code) => {
    if (shuttingDown) return;
    if (streaming) {
      console.log(`  ${C.danger}✖ ${name} 프로세스가 종료되었습니다 (code ${code ?? '?'})${C.r}`);
    }
  });
  return child;
}

/** 일회성 명령 실행 (비동기 — 스피너가 계속 돈다) */
function run(cmdString, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmdString, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    let out = '';
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { out += d.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(stripAnsi(out).split('\n').filter(Boolean).slice(-3).join(' · ') || `exit ${code}`));
    });
  });
}

function killTree(name) {
  const entry = children.get(name);
  if (!entry) return;
  const { pid } = entry.child;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { entry.child.kill('SIGTERM'); } catch { /* 이미 종료됨 */ }
  }
  children.delete(name);
}

/* ---------- 대기 헬퍼 ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tcpOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
    setTimeout(() => { s.destroy(); resolve(false); }, 800);
  });
}
async function waitTcp(port, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await tcpOpen(port)) return;
    await sleep(500);
  }
  throw new Error(`:${port} 응답 없음 (${timeoutMs / 1000}s)`);
}
async function httpOk(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}
async function waitHttp(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await httpOk(url)) return;
    await sleep(500);
  }
  throw new Error(`${url} 응답 없음 (${timeoutMs / 1000}s)`);
}

/* ---------- 부팅 스텝 (스피너) ---------- */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
async function step(label, fn) {
  let i = 0;
  let timer;
  if (TTY) {
    timer = setInterval(() => {
      process.stdout.write(`\r  ${C.cyan}${FRAMES[i++ % FRAMES.length]}${C.r} ${C.text}${label}${C.r} `);
    }, 80);
  } else {
    console.log(`  … ${label}`);
  }
  try {
    const info = await fn();
    if (timer) clearInterval(timer);
    process.stdout.write(`\r  ${C.lime}✔${C.r} ${C.text}${label}${C.r} ${C.faint}${info ?? ''}${C.r}  \n`);
  } catch (e) {
    if (timer) clearInterval(timer);
    process.stdout.write(`\r  ${C.danger}✖ ${label} — ${e.message}${C.r}\n`);
    throw e;
  }
}

function tail(name, n = 12) {
  const entry = children.get(name);
  if (!entry || entry.buffer.length === 0) return;
  console.log(`\n  ${C.faint}[${name}] 마지막 로그 ↓${C.r}`);
  for (const line of entry.buffer.slice(-n)) {
    console.log(`  ${C.dim}${stripAnsi(line).slice(0, 160)}${C.r}`);
  }
}

/* ---------- 종료 ---------- */
function stopPostgres() {
  const pgctl = join(os.homedir(), 'AppData', 'Local', 'sowl', 'pg16', 'bin', 'pg_ctl.exe');
  const pgdata = join(os.homedir(), 'AppData', 'Local', 'sowl', 'pgdata');
  if (existsSync(pgctl) && existsSync(pgdata)) {
    spawnSync(pgctl, ['-D', pgdata, '-m', 'fast', 'stop'], { stdio: 'ignore' });
  }
}
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  streaming = false;
  console.log(`\n  ${C.dim}종료하는 중... 부엉이가 둥지로 돌아갑니다 ${C.cyan}zZ${C.r}`);
  for (const name of [...children.keys()]) killTree(name);
  stopPostgres();
  console.log(`  ${C.lime}✔${C.r} ${C.text}모든 서버 정지 완료${C.r}\n`);
  process.exit(code);
}

/* ---------- 상태 패널 + 핫키 ---------- */
function panel(reused) {
  console.log('');
  rule();
  const row = (dot, name, desc, url) =>
    console.log(`  ${dot}●${C.r} ${C.bold}${C.text}${name.padEnd(4)}${C.r} ${C.muted}${desc.padEnd(22)}${C.r} ${C.cyanHi}${url}${C.r}${reused.has(name) ? ` ${C.faint}(기존 프로세스 재사용)` + C.r : ''}`);
  row(C.lime, 'db', 'PostgreSQL 16', 'localhost:5432');
  row(C.magenta, 'api', 'NestJS (watch)', `${API_URL}`);
  row(C.cyan, 'web', 'Vite MPA', `${WEB_URL}`);
  rule();
  console.log(`  ${C.faint}[${C.cyan}o${C.faint}] 브라우저   [${C.cyan}r${C.faint}] 재시작   [${C.cyan}s${C.faint}] 상태   [${C.cyan}g${C.faint}] GitHub 업로드   [${C.cyan}q${C.faint}] 종료${C.r}`);
  rule();
  console.log(`  ${C.faint}live logs ↓${C.r}\n`);
}

function openBrowser() {
  const cmds = {
    win32: ['cmd', ['/c', 'start', '', WEB_URL]],
    darwin: ['open', [WEB_URL]],
  };
  const [cmd, args] = cmds[process.platform] ?? ['xdg-open', [WEB_URL]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, shell: false }).unref();
}

async function restartAppServers() {
  streaming = false;
  console.log(`\n  ${C.violet}↻ api·web 재시작...${C.r}`);
  killTree('api');
  killTree('web');
  await sleep(800);
  await step('NestJS API 재기동', async () => {
    launch('api', `${PNPM} --filter @sowl/api start:dev`, ROOT);
    await waitHttp(`${API_URL}/health`, 120_000);
    return ':3001';
  });
  await step('Vite 웹 재기동', async () => {
    launch('web', `${PNPM} --filter @sowl/web dev`, ROOT);
    await waitHttp(WEB_URL, 60_000);
    return ':5173';
  });
  console.log(`  ${C.lime}✔ 재시작 완료${C.r}\n`);
  streaming = true;
}

/* ---------- 상태 점검 ([s]) ---------- */
async function gitSummary() {
  try {
    const branch = (await run('git rev-parse --abbrev-ref HEAD', ROOT)).trim();
    const dirty = (await run('git status --porcelain', ROOT)).trim();
    const n = dirty ? dirty.split('\n').length : 0;
    return `${branch} 브랜치 · ${n ? `수정된 파일 ${n}개 (업로드 대기 — [g])` : '커밋할 변경 없음'}`;
  } catch { return null; }
}

async function showStatus() {
  const wasStreaming = streaming;
  streaming = false;
  console.log(`\n  ${C.violet}◎ 상태 점검...${C.r}`);
  const [db, api, web] = await Promise.all([
    tcpOpen(5432), httpOk(`${API_URL}/health`), httpOk(WEB_URL),
  ]);
  rule();
  const row = (up, name, desc, url) =>
    console.log(`  ${up ? C.lime : C.danger}●${C.r} ${C.bold}${C.text}${name.padEnd(4)}${C.r} ${C.muted}${desc.padEnd(22)}${C.r} ${up ? C.cyanHi : C.faint}${url.padEnd(28)}${C.r} ${up ? `${C.lime}작동 중` : `${C.danger}응답 없음`}${C.r}`);
  row(db, 'db', 'PostgreSQL 16', 'localhost:5432');
  row(api, 'api', 'NestJS (watch)', API_URL);
  row(web, 'web', 'Vite MPA', WEB_URL);
  const git = await gitSummary();
  if (git) console.log(`  ${C.dim}git${C.r}  ${C.muted}${git}${C.r}`);
  rule();
  if (!db || !api || !web) {
    console.log(`  ${C.faint}응답 없는 서버가 있으면 [${C.cyan}r${C.faint}] 재시작을 눌러 주세요.${C.r}`);
  }
  console.log('');
  streaming = wasStreaming;
}

/* ---------- GitHub 업로드 ([g]) ---------- */
let uploading = false;
async function gitUpload() {
  if (uploading) return;
  uploading = true;
  const wasStreaming = streaming;
  streaming = false;
  console.log('');
  try {
    const { gitPush } = await import('./git-push.mjs');
    await gitPush();
  } catch (e) {
    console.log(`  ${C.danger}✖ GitHub 업로드 실패 — ${e.message}${C.r}`);
  }
  console.log('');
  streaming = wasStreaming;
  uploading = false;
}

function hotkeys() {
  if (!process.stdin.isTTY) return;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (_str, key) => {
    if (!key) return;
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) shutdown(0);
    else if (key.name === 'o') openBrowser();
    else if (key.name === 'r') void restartAppServers().catch(() => shutdown(1));
    else if (key.name === 's') void showStatus();
    else if (key.name === 'g') void gitUpload();
  });
}

/* ---------- 메인 ---------- */
async function main() {
  banner();
  const reused = new Set();
  try {
    /* 0. pnpm 탐지 */
    await step('pnpm 확인', async () => {
      PNPM = resolvePnpm();
      return PNPM === 'pnpm' ? 'PATH' : PNPM.replace(/"/g, '');
    });

    /* 1. 의존성 설치 (처음 받은 PC) */
    if (!existsSync(join(ROOT, 'node_modules', '.pnpm'))) {
      await step('의존성 설치 (처음 한 번, 몇 분 걸릴 수 있음)', async () => {
        await run(`${PNPM} install`, ROOT);
        return 'node_modules';
      });
    }

    /* 2. 환경 파일 준비 */
    await step('환경 파일 확인 (.env)', async () => {
      const envPath = join(ROOT, 'apps', 'api', '.env');
      if (existsSync(envPath)) return '있음';
      let content = readFileSync(join(ROOT, '.env.example'), 'utf8');
      content = content.replace('여기에-긴-랜덤-문자열', `sowl-admin-${randomBytes(20).toString('hex')}`);
      writeFileSync(envPath, content);
      return '생성 (ADMIN_TOKEN 랜덤 발급)';
    });

    /* 3. 공용 패키지 빌드 */
    await step('shared 패키지 빌드', async () => {
      await run(`${PNPM} --filter @sowl/shared build`, ROOT);
      return 'CJS + ESM';
    });

    /* 4. Prisma Client 생성 */
    await step('Prisma Client 생성', async () => {
      await run(`${PNPM} --filter @sowl/api exec prisma generate`, ROOT);
      return 'ok';
    });

    /* 5. DB 기동 */
    await step('PostgreSQL 16 기동', async () => {
      if (await tcpOpen(5432)) { reused.add('db'); return ':5432 (재사용)'; }
      launch('db', 'node scripts/local-db.mjs', join(ROOT, 'apps', 'api'));
      await waitTcp(5432, 90_000);
      return ':5432';
    });

    /* 6. 마이그레이션 + 시드 */
    await step('DB 마이그레이션', async () => {
      await run(`${PNPM} --filter @sowl/api exec prisma migrate deploy`, ROOT);
      return 'up to date';
    });
    await step('초기 데이터 확인', async () => {
      const out = await run(`${PNPM} --filter @sowl/api exec node scripts/ensure-db.cjs`, ROOT);
      return out.includes('건너뜀') ? '이미 초기화됨' : '시드 주입';
    });

    /* 7. API + 웹 기동 */
    await step('NestJS API 기동', async () => {
      if (await httpOk(`${API_URL}/health`)) { reused.add('api'); return ':3001 (재사용)'; }
      launch('api', `${PNPM} --filter @sowl/api start:dev`, ROOT);
      await waitHttp(`${API_URL}/health`, 120_000);
      return ':3001';
    });
    await step('Vite 웹 기동', async () => {
      if (await httpOk(WEB_URL)) { reused.add('web'); return ':5173 (재사용)'; }
      launch('web', `${PNPM} --filter @sowl/web dev`, ROOT);
      await waitHttp(WEB_URL, 60_000);
      return ':5173';
    });
  } catch {
    for (const name of children.keys()) tail(name);
    shutdown(1);
    return;
  }

  panel(reused);
  streaming = true;
  hotkeys();

  // 더블클릭 실행(sowl-server.bat)일 때는 사이트를 바로 열어준다
  if (process.argv.includes('--open')) openBrowser();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main();
