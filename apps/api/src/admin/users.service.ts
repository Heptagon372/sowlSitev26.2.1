import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import { ERROR_CODES, type AdminUserRow } from '@sowl/shared';
import type { Request } from 'express';
import { LogsService } from '../common/logs/logs.service';
import { PrismaService } from '../prisma/prisma.service';

/** 계정이 잠긴 상태인지 (관리자 수동 잠금은 lockedUntil을 먼 미래로 둔다) */
const isLocked = (u: User) => !!u.lockedUntil && u.lockedUntil > new Date();

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
  ) {}

  async list(query: {
    q?: string;
    role?: Role;
    locked?: boolean;
  }): Promise<AdminUserRow[]> {
    const users = await this.prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { studentId: { contains: query.q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const whitelist = new Set(
      (await this.prisma.memberWhitelist.findMany({ select: { studentId: true } })).map(
        (w) => w.studentId,
      ),
    );
    return users
      .filter((u) => (query.locked === undefined ? true : isLocked(u) === query.locked))
      .map((u) => ({
        id: u.id,
        studentId: u.studentId,
        name: u.name,
        role: u.role,
        generation: u.generation,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        lockedUntil: isLocked(u) ? u.lockedUntil!.toISOString() : null,
        whitelisted: whitelist.has(u.studentId),
      }));
  }

  /**
   * 등급 변경 — 감사 로그에 사유까지 기록.
   * 자기 자신의 ADMIN 권한은 스스로 내릴 수 없다 (마지막 관리자 잠김 방지).
   */
  async changeRole(
    actor: User,
    targetId: string,
    role: Role,
    reason: string | null,
    generation: number | undefined,
    req: Request,
  ): Promise<AdminUserRow[]> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '계정을 찾을 수 없습니다.',
      });
    }
    if (target.id === actor.id && role !== 'ADMIN') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '자기 자신의 관리자 권한은 내릴 수 없습니다.',
      });
    }
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: '마지막 관리자는 강등할 수 없습니다.',
        });
      }
    }
    await this.prisma.user.update({
      where: { id: targetId },
      data: { role, ...(generation !== undefined ? { generation } : {}) },
    });
    void this.logs.audit(actor.id, 'ROLE_CHANGE', req, {
      targetType: 'User',
      targetId: target.studentId,
      reason,
      before: { role: target.role },
      after: { role, ...(generation !== undefined ? { generation } : {}) },
    });
    return this.list({});
  }

  async setLock(
    actor: User,
    targetId: string,
    locked: boolean,
    reason: string | null,
    req: Request,
  ): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return;
    if (target.id === actor.id) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '자기 자신의 계정은 잠글 수 없습니다.',
      });
    }
    await this.prisma.user.update({
      where: { id: targetId },
      data: {
        lockedUntil: locked ? new Date('2999-12-31T00:00:00Z') : null,
        failedLogins: 0,
      },
    });
    void this.logs.audit(actor.id, locked ? 'USER_LOCK' : 'USER_UNLOCK', req, {
      targetType: 'User',
      targetId: target.studentId,
      reason,
    });
  }

  /** 강제 로그아웃 — 리프레시 토큰 전부 폐기 (남은 access 토큰은 최장 30분 내 만료) */
  async forceLogout(actor: User, targetId: string, req: Request): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return;
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    void this.logs.audit(actor.id, 'FORCE_LOGOUT', req, {
      targetType: 'User',
      targetId: target.studentId,
    });
  }
}
