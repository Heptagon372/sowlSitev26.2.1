import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AdminApplicationDetail, AdminListResult } from '@sowl/shared';
import type { Request } from 'express';
import { AdminGuard, ElevatedGuard } from '../common/guards/auth.guards';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LogsService } from '../common/logs/logs.service';
import { AdminService } from './admin.service';

/**
 * 지원서 관리 — ADMIN 세션 필요.
 * 개인정보 원본 조회(상세)와 전체 내보내기는 §8 elevated 세션까지 요구한다.
 */
@Controller('admin/applications')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly logs: LogsService,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('interest') interest?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ): Promise<AdminListResult> {
    return this.admin.list({
      q,
      interest,
      order: order === 'asc' ? 'asc' : 'desc',
      page,
      pageSize,
    });
  }

  @Get('export')
  @UseGuards(ElevatedGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sowl-applications.csv"')
  exportCsv(@CurrentUser() actor: User, @Req() req: Request): Promise<string> {
    void this.logs.audit(actor.id, 'EXPORT', req, {
      targetType: 'Applications',
    });
    return this.admin.exportCsv();
  }

  @Get(':id')
  @UseGuards(ElevatedGuard)
  detail(@Param('id') id: string): Promise<AdminApplicationDetail> {
    return this.admin.detail(id);
  }
}
