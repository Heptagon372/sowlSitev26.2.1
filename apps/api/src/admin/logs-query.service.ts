import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccessLogRow, AuditLogRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface LogQuery {
  from?: string;
  to?: string;
  action?: string;
  q?: string; // 학번 검색
  page?: number;
}

const PAGE_SIZE = 50;

function range(query: LogQuery): Prisma.DateTimeFilter | undefined {
  if (!query.from && !query.to) return undefined;
  return {
    ...(query.from ? { gte: new Date(query.from) } : {}),
    ...(query.to ? { lte: new Date(`${query.to}T23:59:59`) } : {}),
  };
}

@Injectable()
export class LogsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async access(query: LogQuery): Promise<{ total: number; items: AccessLogRow[] }> {
    const where: Prisma.AccessLogWhereInput = {
      ...(range(query) ? { createdAt: range(query) } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.q ? { studentId: { contains: query.q } } : {}),
    };
    const page = Math.max(1, query.page ?? 1);
    const [total, logs] = await Promise.all([
      this.prisma.accessLog.count({ where }),
      this.prisma.accessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    const userIds = [...new Set(logs.map((l) => l.userId).filter((v): v is string => !!v))];
    const names = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return {
      total,
      items: logs.map((l) => ({
        id: l.id,
        studentId: l.studentId,
        userName: l.userId ? (names.get(l.userId) ?? null) : null,
        action: l.action,
        path: l.path,
        ipHash: l.ipHash,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async audit(query: LogQuery): Promise<{ total: number; items: AuditLogRow[] }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(range(query) ? { createdAt: range(query) } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.q ? { actor: { studentId: { contains: query.q } } } : {}),
    };
    const page = Math.max(1, query.page ?? 1);
    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { actor: { select: { name: true, studentId: true } } },
      }),
    ]);
    return {
      total,
      items: logs.map((l) => ({
        id: l.id,
        actorName: l.actor.name,
        actorStudentId: l.actor.studentId,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        reason: l.reason,
        ipHash: l.ipHash,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  /** CSV 내보내기 (elevated 전용 — 컨트롤러에서 잠근다) */
  async exportCsv(kind: 'access' | 'audit'): Promise<string> {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    if (kind === 'access') {
      const logs = await this.prisma.accessLog.findMany({ orderBy: { createdAt: 'asc' } });
      const header = ['일시', '액션', '학번', '경로', 'IP해시', 'UserAgent'];
      const lines = logs.map((l) =>
        [
          l.createdAt.toISOString(),
          l.action,
          l.studentId ?? '',
          l.path ?? '',
          l.ipHash,
          l.userAgent ?? '',
        ]
          .map(esc)
          .join(','),
      );
      return String.fromCharCode(0xfeff) + [header.map(esc).join(','), ...lines].join('\r\n');
    }
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { studentId: true, name: true } } },
    });
    const header = ['일시', '행위자', '학번', '액션', '대상', '사유', 'IP해시'];
    const lines = logs.map((l) =>
      [
        l.createdAt.toISOString(),
        l.actor.name,
        l.actor.studentId,
        l.action,
        `${l.targetType ?? ''}:${l.targetId ?? ''}`,
        l.reason ?? '',
        l.ipHash,
      ]
        .map(esc)
        .join(','),
    );
    return String.fromCharCode(0xfeff) + [header.map(esc).join(','), ...lines].join('\r\n');
  }
}
