import { Body, Controller, HttpStatus, Ip, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ApplicationResult } from '@sowl/shared';
import type { Request, Response } from 'express';
import { ACCESS_COOKIE, TokenService } from '../auth/token.service';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
@UseGuards(ThrottlerGuard)
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly tokens: TokenService,
  ) {}

  @Post()
  async submit(
    @Body() dto: CreateApplicationDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationResult> {
    // 신청은 로그인 없이 누구나 — 로그인 상태라면 계정만 연결해 둔다 (②§3)
    const token = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const userId = token ? (this.tokens.verifyAccess(token)?.sub ?? null) : null;

    const result = await this.applications.submit(dto, ip, userId);
    // 신규 제출은 201, 재제출(갱신)은 200
    res.status(result.updated ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }
}
