import { Injectable } from '@nestjs/common';
import type { ClubStats } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<ClubStats> {
    const [rows, config, rackCount] = await Promise.all([
      this.prisma.clubStat.findMany(),
      this.prisma.recruitConfig.findUnique({ where: { id: 1 } }),
      this.prisma.rackDevice.count(),
    ]);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      members: Number(map.get('members') ?? 0),
      hasServerRack: map.get('hasServerRack') === 'true',
      // 서버랙 관리(§9-3)에 장비가 등록되어 있으면 그 수가 우선한다
      servers: rackCount > 0 ? rackCount : Number(map.get('servers') ?? 0),
      projects: Number(map.get('projects') ?? 0),
      generation: config?.generation ?? 15,
      roomLocation: map.get('roomLocation') ?? '나눔관 지하 1층',
    };
  }
}
