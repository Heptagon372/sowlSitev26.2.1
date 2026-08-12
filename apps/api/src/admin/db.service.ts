import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { ERROR_CODES } from '@sowl/shared';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { LogsService } from '../common/logs/logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';

const MAX_FAILS = 3;
const BLOCK_MINUTES = 10;
const MAX_ROWS = 200;

/**
 * DB 접근 비밀번호(§8) — DB_ACCESS_PASSPHRASE는 서버 구동 시 환경변수로만
 * 설정된다. 웹에서 조회·변경하는 경로는 어디에도 만들지 않는다.
 */
@Injectable()
export class DbConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly logs: LogsService,
  ) {}

  /** 사용자별 실패 횟수 — 3회 실패 시 10분 차단 (프로세스 메모리, 재시작 시 초기화) */
  private readonly attempts = new Map<string, { fails: number; blockedUntil: number }>();

  async unlock(user: User, passphrase: string, req: Request, res: Response): Promise<{ ok: true; expiresInSec: number }> {
    const state = this.attempts.get(user.id) ?? { fails: 0, blockedUntil: 0 };
    if (state.blockedUntil > Date.now()) {
      const mins = Math.ceil((state.blockedUntil - Date.now()) / 60_000);
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: `실패가 누적되어 차단되었습니다. ${mins}분 후 다시 시도해 주세요.`,
        },
        429,
      );
    }

    const expected = process.env.DB_ACCESS_PASSPHRASE ?? '';
    // 길이가 달라도 안전하게 — 해시를 먼저 통과시킨 뒤 timingSafeEqual
    const ha = createHash('sha256').update(passphrase).digest();
    const hb = createHash('sha256').update(expected).digest();
    const ok = expected.length > 0 && timingSafeEqual(ha, hb);

    if (!ok) {
      state.fails += 1;
      if (state.fails >= MAX_FAILS) {
        state.blockedUntil = Date.now() + BLOCK_MINUTES * 60_000;
        state.fails = 0;
      }
      this.attempts.set(user.id, state);
      void this.logs.audit(user.id, 'DB_UNLOCK_FAIL', req);
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHENTICATED,
        message: 'DB 접근 비밀번호가 올바르지 않습니다.',
      });
    }

    this.attempts.delete(user.id);
    this.tokens.setElevatedCookie(res, this.tokens.signElevated(user.id));
    void this.logs.audit(user.id, 'DB_UNLOCK', req);
    return { ok: true, expiresInSec: 15 * 60 };
  }

  /** 읽기 전용 쿼리 — READ ONLY 트랜잭션 안에서만 실행한다 */
  async query(sql: string): Promise<{ rows: unknown[]; truncated: boolean }> {
    const trimmed = sql.trim().replace(/;+\s*$/, '');
    if (!/^(select|with|show|explain)\b/i.test(trimmed) || trimmed.includes(';')) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'SELECT / WITH / SHOW / EXPLAIN 단일 쿼리만 실행할 수 있습니다.',
      });
    }
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return tx.$queryRawUnsafe<unknown[]>(trimmed);
    });
    const list = Array.isArray(rows) ? rows : [rows];
    // BigInt·Date는 JSON 직렬화가 안 되므로 여기서 변환한다
    const safe = JSON.parse(
      JSON.stringify(list.slice(0, MAX_ROWS), (_k, v: unknown) =>
        typeof v === 'bigint' ? Number(v) : v,
      ),
    ) as unknown[];
    return { rows: safe, truncated: list.length > MAX_ROWS };
  }
}
