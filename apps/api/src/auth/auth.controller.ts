import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type { SessionUser } from '@sowl/shared';
import type { Request, Response } from 'express';
import { AuthGuard } from '../common/guards/auth.guards';
import { CurrentUser, toSessionUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 무차별 대입 방지 — IP당 10분에 가입 5회 / 로그인 20회
  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600_000, limit: 5 } })
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    return toSessionUser(await this.auth.signup(dto, req, res));
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600_000, limit: 20 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    return toSessionUser(await this.auth.login(dto, req, res));
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.logout(req, res);
    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    return toSessionUser(await this.auth.refresh(req, res));
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User): SessionUser {
    return toSessionUser(user);
  }
}
