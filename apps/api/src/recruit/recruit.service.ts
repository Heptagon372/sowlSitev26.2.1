import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type RecruitInfo, type RecruitPhase } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecruitService {
  constructor(private readonly prisma: PrismaService) {}

  async getInfo(): Promise<RecruitInfo> {
    const config = await this.prisma.recruitConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '모집 설정이 없습니다. seed를 실행해 주세요.',
      });
    }
    return {
      generation: config.generation,
      startsAt: config.startsAt.toISOString(),
      endsAt: config.endsAt.toISOString(),
      phase: this.phaseOf(config.startsAt, config.endsAt),
      periodText: this.periodText(config.startsAt, config.endsAt),
      googleFormUrl: config.googleFormUrl,
    };
  }

  phaseOf(startsAt: Date, endsAt: Date, now = new Date()): RecruitPhase {
    if (now < startsAt) return 'before';
    if (now > endsAt) return 'closed';
    return 'open';
  }

  /** '2026.08.01 ~ 09.06' 형태 (KST 기준) */
  private periodText(start: Date, end: Date): string {
    const kst = (d: Date) => {
      const t = new Date(d.getTime() + 9 * 3600_000);
      return {
        y: t.getUTCFullYear(),
        m: String(t.getUTCMonth() + 1).padStart(2, '0'),
        d: String(t.getUTCDate()).padStart(2, '0'),
      };
    };
    const s = kst(start);
    const e = kst(end);
    const right = (s.y === e.y ? '' : `${e.y}.`) + `${e.m}.${e.d}`;
    return `${s.y}.${s.m}.${s.d} ~ ${right}`;
  }
}
