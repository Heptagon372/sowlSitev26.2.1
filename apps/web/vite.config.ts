import { readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * MPA 엔트리 수집 — 루트와 admin/·member/(카테고리 하위 폴더 포함)의
 * 모든 .html 을 재귀로 찾는다. 엔트리 키는 경로 기반이라 파일명이 겹쳐도 안전하다.
 */
function htmlInputs(): Record<string, string> {
  const root = resolve(__dirname);
  const inputs: Record<string, string> = {};

  const walk = (dir: string, depth: number) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        // 빌드 산출물·정적 자산·의존성은 건너뛴다
        if (['dist', 'node_modules', 'public', 'src'].includes(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.name.endsWith('.html')) {
        const key = relative(root, full).replace(/\\/g, '/').replace(/\.html$/, '').replace(/\//g, '-');
        inputs[key] = full;
      }
    }
  };
  walk(root, 0);
  return inputs;
}

export default defineConfig({
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: htmlInputs(),
    },
  },
});
