// 임시 검증용: 모집 종료일을 인자로 설정
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.recruitConfig.update({ where: { id: 1 }, data: { endsAt: new Date(process.argv[2]) } })
  .then((r) => console.log('endsAt →', r.endsAt.toISOString()))
  .finally(() => p.$disconnect());
