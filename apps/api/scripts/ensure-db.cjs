/**
 * 구동기용 — DB에 초기 데이터가 없을 때만 시드를 넣는다.
 * (이미 운영 중인 DB의 값은 절대 덮어쓰지 않는다)
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { seed } = require('../prisma/seed.cjs');

const prisma = new PrismaClient();

async function main() {
  const config = await prisma.recruitConfig.findUnique({ where: { id: 1 } });
  if (config) {
    console.log('[db] 시드 확인 — 이미 초기화됨 (건너뜀)');
    return;
  }
  await seed(prisma);
  console.log('[db] 시드 완료 — RecruitConfig + ClubStat 주입');
}

main()
  .catch((e) => {
    console.error('[db] 시드 실패:', e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
