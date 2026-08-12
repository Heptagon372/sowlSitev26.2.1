import { Injectable } from '@nestjs/common';
import type { PointsPage, RankingRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 동아리 포인트 — 적립 내역(PointLog)과 User.points 합계를 항상 함께 갱신한다.
 * 세미나 출석·과제 채점 등 다른 서비스가 award()를 호출한다.
 */
@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 같은 kind+refId로 이미 적립했으면 중복 지급하지 않는다 */
  async award(
    userId: string,
    delta: number,
    kind: string,
    reason: string,
    refId?: string,
  ): Promise<void> {
    if (delta === 0) return;
    if (refId) {
      const dup = await this.prisma.pointLog.findFirst({
        where: { userId, kind, refId },
        select: { id: true },
      });
      if (dup) return;
    }
    await this.prisma.$transaction([
      this.prisma.pointLog.create({
        data: { userId, delta, kind, reason, refId: refId ?? null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { points: { increment: delta } },
      }),
    ]);
  }

  /** 이미 준 포인트를 정정한다 (과제 점수 재채점 등) */
  async replace(
    userId: string,
    delta: number,
    kind: string,
    reason: string,
    refId: string,
  ): Promise<void> {
    const previous = await this.prisma.pointLog.findMany({ where: { userId, kind, refId } });
    const already = previous.reduce((sum, p) => sum + p.delta, 0);
    if (already === delta) return;
    await this.prisma.$transaction([
      this.prisma.pointLog.deleteMany({ where: { userId, kind, refId } }),
      ...(delta !== 0
        ? [this.prisma.pointLog.create({ data: { userId, delta, kind, reason, refId } })]
        : []),
      this.prisma.user.update({
        where: { id: userId },
        data: { points: { increment: delta - already } },
      }),
    ]);
  }

  async page(userId: string, generation?: number): Promise<PointsPage> {
    const [me, logs, users, gens] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { points: true },
      }),
      this.prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.user.findMany({
        where: {
          role: { in: ['MEMBER', 'ADMIN'] },
          ...(generation ? { generation } : {}),
        },
        orderBy: [{ points: 'desc' }, { name: 'asc' }],
        take: 100,
        select: { id: true, name: true, generation: true, points: true },
      }),
      this.prisma.user.findMany({
        where: { role: { in: ['MEMBER', 'ADMIN'] }, generation: { not: null } },
        distinct: ['generation'],
        orderBy: { generation: 'desc' },
        select: { generation: true },
      }),
    ]);

    const ranking: RankingRow[] = users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      generation: u.generation,
      points: u.points,
      isMe: u.id === userId,
    }));

    return {
      myPoints: me.points,
      myRank: ranking.find((r) => r.isMe)?.rank ?? null,
      logs: logs.map((l) => ({
        id: l.id,
        delta: l.delta,
        kind: l.kind,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
      ranking,
      generations: gens
        .map((g) => g.generation)
        .filter((g): g is number => g !== null),
    };
  }
}
