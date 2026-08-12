import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { ERROR_CODES } from '@sowl/shared';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';
import { ACCESS_COOKIE, ELEVATED_COOKIE, TokenService } from '../../auth/token.service';

export interface AuthedRequest extends Request {
  user: User;
}

/**
 * 로그인(access 쿠키) 필수. 토큰 검증 후 DB에서 유저를 새로 읽는다 —
 * 강등·삭제가 토큰 만료를 기다리지 않고 즉시 반영되게 하기 위해서다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    protected readonly tokens: TokenService,
    protected readonly prisma: PrismaService,
    protected readonly logs: LogsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const payload = token ? this.tokens.verifyAccess(token) : null;
    const user = payload
      ? await this.prisma.user.findUnique({ where: { id: payload.sub } })
      : null;
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHENTICATED,
        message: '로그인이 필요합니다.',
      });
    }
    req.user = user;
    return true;
  }
}

/** MEMBER 또는 ADMIN — GUEST는 403 MEMBER_ONLY (프론트가 이 코드로 §6 모달을 띄운다) */
@Injectable()
export class MemberGuard extends AuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user.role === 'GUEST') {
      void this.logs.access('MEMBER_DENIED', req, {
        userId: req.user.id,
        studentId: req.user.studentId,
      });
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: 'S.OWL 부원만 이용할 수 있습니다.',
      });
    }
    return true;
  }
}

/** ADMIN 전용 */
@Injectable()
export class AdminGuard extends AuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: ERROR_CODES.ADMIN_ONLY,
        message: '관리자만 이용할 수 있습니다.',
      });
    }
    return true;
  }
}

/**
 * DB 접근 비밀번호(§8)로 발급된 15분짜리 elevated 세션 필수.
 * AdminGuard 뒤에 붙여 쓴다: @UseGuards(AdminGuard, ElevatedGuard)
 */
@Injectable()
export class ElevatedGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[ELEVATED_COOKIE];
    if (!token || !req.user || !this.tokens.verifyElevated(token, req.user.id)) {
      throw new ForbiddenException({
        code: ERROR_CODES.ELEVATION_REQUIRED,
        message: 'DB 접근 비밀번호 확인이 필요합니다.',
      });
    }
    return true;
  }
}
