/**
 * Docker 없이 로컬에서 PostgreSQL 16을 띄우는 개발용 스크립트.
 * (Docker가 있다면 루트에서 `docker compose up -d` 를 쓰면 되고, 이 스크립트는 필요 없다)
 *
 * 주의 — 이 프로젝트 경로에는 한글("바탕 화면")이 포함되어 있는데,
 * Windows에서 postgres.exe가 CP949 경로(argv)를 UTF-8로 검증하다 initdb가 실패한다.
 * 그래서 @embedded-postgres 가 받아 둔 바이너리를 ASCII 경로(%LOCALAPPDATA%\sowl\pg16)로
 * 미러링한 뒤 직접 spawn 한다. 데이터 디렉터리도 같은 이유로 ASCII 경로에 둔다.
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const HOME = join(os.homedir(), 'AppData', 'Local', 'sowl');
const DATA_DIR = join(HOME, 'pgdata');
const PORT = 5432;
const USER = 'sowl';
const PASSWORD = 'sowl';
const DB_NAME = 'sowl';

/** @embedded-postgres 플랫폼 패키지의 native 디렉터리를 찾는다 */
function findNativeDir() {
  const platformPkg = {
    win32: '@embedded-postgres/windows-x64',
    darwin: process.arch === 'arm64' ? '@embedded-postgres/darwin-arm64' : '@embedded-postgres/darwin-x64',
    linux: process.arch === 'arm64' ? '@embedded-postgres/linux-arm64' : '@embedded-postgres/linux-x64',
  }[process.platform];
  const epEntry = require.resolve('embedded-postgres');
  const epRequire = createRequire(epEntry);
  // exports 필드가 package.json을 노출하지 않으므로 엔트리(dist/index.js)에서 상위로 올라간다
  const entry = epRequire.resolve(platformPkg);
  const pkgDir = dirname(dirname(entry));
  const pkgJson = join(pkgDir, 'package.json');
  return { nativeDir: join(pkgDir, 'native'), version: JSON.parse(readFileSync(pkgJson, 'utf8')).version };
}

/** 바이너리 경로에 비ASCII 문자가 있으면 ASCII 경로로 미러링 */
function ensureAsciiBinaries() {
  const { nativeDir, version } = findNativeDir();
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7f]/.test(nativeDir)) return nativeDir;

  const mirror = join(HOME, 'pg16');
  const marker = join(mirror, '.mirrored-version');
  if (!existsSync(marker) || readFileSync(marker, 'utf8').trim() !== version) {
    console.log('[db] PostgreSQL 바이너리를 ASCII 경로로 복사:', mirror);
    cpSync(nativeDir, mirror, { recursive: true });
    writeFileSync(marker, version);
  }
  return mirror;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} 실패 (${r.status})\n${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  }
  return r;
}

function main() {
  mkdirSync(HOME, { recursive: true });
  const pgHome = ensureAsciiBinaries();
  const bin = (name) => join(pgHome, 'bin', process.platform === 'win32' ? `${name}.exe` : name);

  if (!existsSync(join(DATA_DIR, 'PG_VERSION'))) {
    console.log('[db] 처음 실행 — 데이터 디렉터리 초기화:', DATA_DIR);
    const pwFile = join(HOME, '.pgpass-init');
    writeFileSync(pwFile, `${PASSWORD}\n`);
    run(bin('initdb'), [
      `--pgdata=${DATA_DIR}`,
      '--auth=password',
      `--username=${USER}`,
      `--pwfile=${pwFile}`,
      '--encoding=UTF8',
      '--no-locale', // 한국어 Windows 로케일(Korean_Korea.949)로는 initdb가 실패한다
    ]);
    // 단일 사용자 모드로 앱 데이터베이스 생성 (배포판에 createdb 바이너리가 없음)
    const r = spawnSync(bin('postgres'), ['--single', '-D', DATA_DIR, '-j', 'postgres'], {
      input: `CREATE DATABASE ${DB_NAME};\n`,
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      throw new Error(`데이터베이스 생성 실패\n${r.stderr ?? ''}`);
    }
    console.log('[db] 데이터베이스 생성 완료:', DB_NAME);
  }

  const server = spawn(bin('postgres'), ['-D', DATA_DIR, '-p', String(PORT)], {
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  server.stderr.on('data', (chunk) => {
    const line = chunk.toString();
    if (line.includes('ready to accept connections')) {
      console.log(`[db] PostgreSQL 16 ready on postgresql://${USER}:***@localhost:${PORT}/${DB_NAME}`);
    } else if (line.includes('FATAL') || line.includes('ERROR')) {
      process.stderr.write(line);
    }
  });
  server.on('exit', (code) => {
    console.log('[db] postgres 종료', code ?? '');
    process.exit(code ?? 0);
  });

  const shutdown = () => {
    spawnSync(bin('pg_ctl'), ['-D', DATA_DIR, '-m', 'fast', 'stop'], { encoding: 'utf8' });
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  main();
} catch (e) {
  console.error('[db] 시작 실패:', e.message ?? e);
  process.exit(1);
}
