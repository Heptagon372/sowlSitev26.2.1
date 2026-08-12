import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { USER_VALIDATION, type WhitelistRow } from '@sowl/shared';
import type { Request } from 'express';
import { LogsService } from '../common/logs/logs.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 학번 화이트리스트 — GUEST → MEMBER 승격의 유일한 수단. (설계도 ② §1-2)
 * 가입 순서와 등록 순서가 어느 쪽이든 결과가 같아야 한다:
 *  - 등록 시 이미 가입한 계정이 있으면 즉시 승격
 *  - 미가입이면 명단에만 남고, 가입 시점에 MEMBER로 시작 (auth.service)
 *  - 삭제 시 해당 계정은 MEMBER → GUEST 강등
 */
@Injectable()
export class WhitelistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
  ) {}

  async list(): Promise<WhitelistRow[]> {
    const rows = await this.prisma.memberWhitelist.findMany({
      orderBy: { addedAt: 'desc' },
    });
    const joined = new Set(
      (
        await this.prisma.user.findMany({
          where: { studentId: { in: rows.map((r) => r.studentId) } },
          select: { studentId: true },
        })
      ).map((u) => u.studentId),
    );
    return rows.map((r) => ({
      studentId: r.studentId,
      generation: r.generation,
      note: r.note,
      addedBy: r.addedBy,
      addedAt: r.addedAt.toISOString(),
      joined: joined.has(r.studentId),
    }));
  }

  /** 한 줄에 하나씩 붙여넣은 학번들을 일괄 등록 (신입 기수 등록용) */
  async add(
    actor: User,
    studentIds: string[],
    generation: number | undefined,
    note: string | undefined,
    req: Request,
  ): Promise<{ added: number; promoted: number; invalid: string[] }> {
    const invalid: string[] = [];
    let added = 0;
    let promoted = 0;

    for (const raw of studentIds) {
      const sid = raw.trim();
      if (!sid) continue;
      if (!USER_VALIDATION.studentIdPattern.test(sid)) {
        invalid.push(sid);
        continue;
      }
      await this.prisma.memberWhitelist.upsert({
        where: { studentId: sid },
        update: { generation: generation ?? undefined, note: note ?? undefined },
        create: {
          studentId: sid,
          generation: generation ?? null,
          note: note ?? null,
          addedBy: actor.studentId,
        },
      });
      added += 1;

      // 이미 가입한 GUEST → 즉시 승격
      const user = await this.prisma.user.findUnique({ where: { studentId: sid } });
      if (user && user.role === 'GUEST') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'MEMBER', generation: generation ?? user.generation },
        });
        promoted += 1;
      }
      void this.logs.audit(actor.id, 'WHITELIST_ADD', req, {
        targetType: 'MemberWhitelist',
        targetId: sid,
        after: { generation: generation ?? null, promoted: !!user && user.role === 'GUEST' },
      });
    }
    return { added, promoted, invalid };
  }

  /** 삭제 → 해당 계정 MEMBER → GUEST 강등 (관리자 확인 모달 뒤에 호출된다) */
  async remove(
    actor: User,
    studentId: string,
    reason: string | null,
    req: Request,
  ): Promise<{ demoted: boolean }> {
    await this.prisma.memberWhitelist
      .delete({ where: { studentId } })
      .catch(() => undefined);

    const user = await this.prisma.user.findUnique({ where: { studentId } });
    let demoted = false;
    if (user && user.role === 'MEMBER') {
      await this.prisma.user.update({ where: { id: user.id }, data: { role: 'GUEST' } });
      demoted = true;
    }
    void this.logs.audit(actor.id, 'WHITELIST_REMOVE', req, {
      targetType: 'MemberWhitelist',
      targetId: studentId,
      reason,
      after: { demoted },
    });
    return { demoted };
  }
}
