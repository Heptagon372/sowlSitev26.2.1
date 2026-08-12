import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ipHash16 } from '../security/ip-hash';

/**
 * 접속 로그(AccessLog) + 감사 로그(AuditLog) 기록기.
 * - IP는 원본을 저장하지 않는다 (해시 앞 16자만)
 * - 로그 기록 실패가 본 요청을 죽이면 안 되므로 내부에서 삼킨다
 */
@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async access(
    action: string,
    req: Pick<Request, 'ip' | 'headers' | 'path'>,
    opts: { userId?: string | null; studentId?: string | null; path?: string } = {},
  ): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          action,
          userId: opts.userId ?? null,
          studentId: opts.studentId ?? null,
          path: opts.path ?? req.path ?? null,
          ipHash: ipHash16(req.ip),
          userAgent: (req.headers['user-agent'] ?? '').slice(0, 250) || null,
        },
      });
    } catch {
      /* 로그 실패는 무시 */
    }
  }

  async audit(
    actorId: string,
    action: string,
    req: Pick<Request, 'ip'>,
    opts: {
      targetType?: string;
      targetId?: string;
      reason?: string | null;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    } = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action,
          targetType: opts.targetType ?? null,
          targetId: opts.targetId ?? null,
          reason: opts.reason ?? null,
          before: opts.before,
          after: opts.after,
          ipHash: ipHash16(req.ip),
        },
      });
    } catch {
      /* 로그 실패는 무시 */
    }
  }
}
