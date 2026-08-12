/**
 * 초기값 시드 — `prisma db seed` 와 구동기(ensure-db)가 함께 쓴다.
 * RecruitConfig는 이미 있으면 건드리지 않고, ClubStat은 시드값으로 맞춘다.
 */
const { PrismaClient } = require('@prisma/client');

async function seed(prisma) {
  // 모집 설정 — 실제 값 확인 필요: 모집 기간(임시), 기수(15기 확인 필요), 구글폼 URL(14기 주소)
  await prisma.recruitConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      generation: 15,
      startsAt: new Date('2026-08-01T00:00:00+09:00'),
      endsAt: new Date('2026-09-06T23:59:59+09:00'),
      googleFormUrl: 'https://forms.gle/Rap3Q3VGTwa9fKZCA',
    },
  });

  // 자랑 숫자 — members·hasServerRack은 확정, servers는 실제 대수 확인 필요(임시 4)
  const stats = [
    { key: 'members', value: '35' },
    { key: 'hasServerRack', value: 'true' },
    { key: 'servers', value: '4' }, // TODO: 실제 서버 대수 확인 후 교체
    { key: 'projects', value: '100' },
    { key: 'roomLocation', value: '나눔관 지하 1층' },
  ];
  for (const s of stats) {
    await prisma.clubStat.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
}

module.exports = { seed };

// `node prisma/seed.cjs` 로 직접 실행됐을 때만 즉시 시드
if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('[seed] RecruitConfig + ClubStat 초기값 주입 완료'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
