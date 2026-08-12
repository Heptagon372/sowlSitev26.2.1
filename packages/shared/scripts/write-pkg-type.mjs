// 듀얼 빌드: 각 출력 디렉터리에 모듈 타입 마커를 심는다
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
writeFileSync(join(root, 'dist/cjs/package.json'), '{"type":"commonjs"}\n');
writeFileSync(join(root, 'dist/esm/package.json'), '{"type":"module"}\n');
