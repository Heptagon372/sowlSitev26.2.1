import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { ERROR_CODES, type SiteSettings } from '@sowl/shared';
import type { Request } from 'express';
import { LogsService } from '../common/logs/logs.service';
import { PrismaService } from '../prisma/prisma.service';

export interface SettingsPatch {
  generation?: number;
  startsAt?: string;
  endsAt?: string;
  googleFormUrl?: string;
  stats?: Partial<SiteSettings['stats']>;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
  ) {}

  async get(): Promise<SiteSettings> {
    const config = await this.prisma.recruitConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '모집 설정이 없습니다. seed를 실행해 주세요.',
      });
    }
    const stats = new Map(
      (await this.prisma.clubStat.findMany()).map((s) => [s.key, s.value]),
    );
    return {
      generation: config.generation,
      startsAt: config.startsAt.toISOString(),
      endsAt: config.endsAt.toISOString(),
      googleFormUrl: config.googleFormUrl,
      stats: {
        members: Number(stats.get('members') ?? 0),
        servers: Number(stats.get('servers') ?? 0),
        projects: Number(stats.get('projects') ?? 0),
        roomLocation: stats.get('roomLocation') ?? '',
      },
    };
  }

  async patch(actor: User, patch: SettingsPatch, req: Request): Promise<SiteSettings> {
    const before = await this.get();

    await this.prisma.recruitConfig.update({
      where: { id: 1 },
      data: {
        ...(patch.generation !== undefined ? { generation: patch.generation } : {}),
        ...(patch.startsAt ? { startsAt: new Date(patch.startsAt) } : {}),
        ...(patch.endsAt ? { endsAt: new Date(patch.endsAt) } : {}),
        ...(patch.googleFormUrl ? { googleFormUrl: patch.googleFormUrl } : {}),
      },
    });

    if (patch.stats) {
      for (const [key, value] of Object.entries(patch.stats)) {
        if (value === undefined) continue;
        await this.prisma.clubStat.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
    }

    const after = await this.get();
    void this.logs.audit(actor.id, 'SETTINGS_UPDATE', req, {
      targetType: 'SiteSettings',
      before: JSON.parse(JSON.stringify(before)),
      after: JSON.parse(JSON.stringify(after)),
    });
    return after;
  }
}
