import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { ERROR_CODES, checkPassword } from '@sowl/shared';
import * as argon2 from 'argon2';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LogsService } from '../common/logs/logs.service';
import { REFRESH_COOKIE, TokenService } from './token.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

const LOCK_AFTER_FAILS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly logs: LogsService,
  ) {}

  /**
   * 회원가입 — 가입 직후 등급은 무조건 GUEST.
   * 예외는 두 가지뿐: 학번이 화이트리스트에 있으면 MEMBER,
   * BOOTSTRAP_ADMIN_STUDENT_ID와 일치하면 ADMIN. (설계도 ② §1)
   */
  async signup(dto: SignupDto, req: Request, res: Response): Promise<User> {
    const pw = checkPassword(dto.password);
    if (!pw.ok) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '비밀번호는 8자 이상이며 특수문자를 1자 이상 포함해야 합니다.',
      });
    }

    const exists = await this.prisma.user.findUnique({
      where: { studentId: dto.studentId },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException({
        code: ERROR_CODES.STUDENT_ID_TAKEN,
        message: '이미 가입된 학번입니다.',
      });
    }

    const whitelisted = await this.prisma.memberWhitelist.findUnique({
      where: { studentId: dto.studentId },
    });
    const isBootstrapAdmin =
      !!process.env.BOOTSTRAP_ADMIN_STUDENT_ID &&
      dto.studentId === process.env.BOOTSTRAP_ADMIN_STUDENT_ID;

    const user = await this.prisma.user.create({
      data: {
        studentId: dto.studentId,
        name: dto.name,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        email: dto.email?.trim() || null,
        role: isBootstrapAdmin ? 'ADMIN' : whitelisted ? 'MEMBER' : 'GUEST',
        generation: whitelisted?.generation ?? null,
      },
    });

    void this.logs.access('SIGNUP', req, { userId: user.id, studentId: user.studentId });
    await this.issueSession(user, res);
    return user;
  }

  async login(dto: LoginDto, req: Request, res: Response): Promise<User> {
    const fail = (): never => {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHENTICATED,
        message: '학번 또는 비밀번호가 올바르지 않습니다.',
      });
    };

    const user = await this.prisma.user.findUnique({ where: { studentId: dto.studentId } });
    if (!user) {
      void this.logs.access('LOGIN_FAIL', req, { studentId: dto.studentId });
      return fail();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        {
          code: ERROR_CODES.ACCOUNT_LOCKED,
          message: `로그인 실패가 누적되어 잠긴 계정입니다. ${mins}분 후 다시 시도해 주세요.`,
        },
        423,
      );
    }

    const ok = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) {
      const fails = user.failedLogins + 1;
      const lock = fails >= LOCK_AFTER_FAILS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: lock
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: fails },
      });
      void this.logs.access(lock ? 'LOCKED' : 'LOGIN_FAIL', req, {
        userId: user.id,
        studentId: user.studentId,
      });
      if (lock) {
        throw new HttpException(
          {
            code: ERROR_CODES.ACCOUNT_LOCKED,
            message: `로그인 5회 실패로 계정이 ${LOCK_MINUTES}분간 잠겼습니다.`,
          },
          423,
        );
      }
      return fail();
    }

    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    void this.logs.access('LOGIN_SUCCESS', req, {
      userId: user.id,
      studentId: user.studentId,
    });
    await this.issueSession(fresh, res);
    return fresh;
  }

  async logout(req: Request, res: Response, userId?: string): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (raw) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.tokens.hashRefresh(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.tokens.clearAuthCookies(res);
    if (userId) void this.logs.access('LOGOUT', req, { userId });
  }

  /** 리프레시 토큰 로테이션 — 옛 토큰은 즉시 폐기하고 새로 발급 */
  async refresh(req: Request, res: Response): Promise<User> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const denied = (): never => {
      this.tokens.clearAuthCookies(res);
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHENTICATED,
        message: '다시 로그인해 주세요.',
      });
    };
    if (!raw) return denied();

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefresh(raw) },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) return denied();

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) return denied();

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    await this.issueSession(user, res);
    return user;
  }

  private async issueSession(user: User, res: Response): Promise<void> {
    const refresh = this.tokens.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
    });
    const access = this.tokens.signAccess({
      sub: user.id,
      sid: user.studentId,
      role: user.role,
      name: user.name,
    });
    this.tokens.setAuthCookies(res, access, refresh.token);
  }

  /** 서버 첫 기동 시 BOOTSTRAP_ADMIN_STUDENT_ID 계정을 ADMIN으로 승격 */
  async bootstrapAdmin(): Promise<void> {
    const sid = process.env.BOOTSTRAP_ADMIN_STUDENT_ID;
    if (!sid) return;
    const user = await this.prisma.user.findUnique({ where: { studentId: sid } });
    if (user && user.role !== 'ADMIN') {
      await this.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      this.logger.log(`BOOTSTRAP_ADMIN: ${sid} 계정을 ADMIN으로 승격했습니다.`);
    }
  }
}
