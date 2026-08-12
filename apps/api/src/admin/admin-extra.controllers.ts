import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import type {
  AdminDashboard,
  AdminUserRow,
  SiteSettings,
  WhitelistRow,
} from '@sowl/shared';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Request, Response } from 'express';
import { AdminGuard, ElevatedGuard } from '../common/guards/auth.guards';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LogsService } from '../common/logs/logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { DbConsoleService } from './db.service';
import { LogsQueryService } from './logs-query.service';
import { RackService } from './rack.service';
import { SettingsService } from './settings.service';
import { UsersService } from './users.service';
import { WhitelistService } from './whitelist.service';

/* ---------- DTO ---------- */

class RoleChangeDto {
  @IsIn(['GUEST', 'MEMBER', 'ADMIN']) role!: Role;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsInt() @Min(1) generation?: number;
}

class LockDto {
  @IsBoolean() locked!: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class WhitelistAddDto {
  @IsArray() @IsString({ each: true }) studentIds!: string[];
  @IsOptional() @IsInt() @Min(1) generation?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

class RackCreateDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsIn(['SERVER', 'SWITCH', 'UPS', 'NAS', 'ETC']) kind!: string;
  @IsInt() @Min(1) startUnit!: number;
  @IsOptional() @IsInt() @Min(1) unitSize?: number;
  @IsOptional() @IsIn(['OK', 'MAINTENANCE', 'OFFLINE']) status?: string;
  @IsOptional() @IsString() @MaxLength(200) purpose?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(300) healthUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class RackUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsIn(['SERVER', 'SWITCH', 'UPS', 'NAS', 'ETC']) kind?: string;
  @IsOptional() @IsInt() @Min(1) startUnit?: number;
  @IsOptional() @IsInt() @Min(1) unitSize?: number;
  @IsOptional() @IsIn(['OK', 'MAINTENANCE', 'OFFLINE']) status?: string;
  @IsOptional() @IsString() @MaxLength(200) purpose?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(300) healthUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class SettingsDto {
  @IsOptional() @IsInt() @Min(1) generation?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsString() @MaxLength(500) googleFormUrl?: string;
  @IsOptional() stats?: {
    members?: number;
    servers?: number;
    projects?: number;
    roomLocation?: string;
  };
}

class UnlockDto {
  @IsString() @MaxLength(500) passphrase!: string;
}

class QueryDto {
  @IsString() @MinLength(1) @MaxLength(5000) sql!: string;
}

/* ---------- 대시보드 ---------- */

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logsQuery: LogsQueryService,
  ) {}

  @Get()
  async summary(): Promise<AdminDashboard> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [users, members, guests, admins, totalApplications, todayApplications, rackDevices, access, audit] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: 'MEMBER' } }),
        this.prisma.user.count({ where: { role: 'GUEST' } }),
        this.prisma.user.count({ where: { role: 'ADMIN' } }),
        this.prisma.application.count(),
        this.prisma.application.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.rackDevice.count(),
        this.logsQuery.access({ page: 1 }),
        this.logsQuery.audit({ page: 1 }),
      ]);
    return {
      users,
      members,
      guests,
      admins,
      totalApplications,
      todayApplications,
      rackDevices,
      recentAccess: access.items.slice(0, 6),
      recentAudit: audit.items.slice(0, 6),
    };
  }
}

/* ---------- 회원 관리 ---------- */

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('role') role?: Role,
    @Query('locked') locked?: string,
  ): Promise<AdminUserRow[]> {
    return this.users.list({
      q,
      role: role && ['GUEST', 'MEMBER', 'ADMIN'].includes(role) ? role : undefined,
      locked: locked === undefined || locked === '' ? undefined : locked === 'true',
    });
  }

  @Patch(':id/role')
  changeRole(
    @Param('id') id: string,
    @Body() dto: RoleChangeDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ): Promise<AdminUserRow[]> {
    return this.users.changeRole(actor, id, dto.role, dto.reason ?? null, dto.generation, req);
  }

  @Patch(':id/lock')
  async lock(
    @Param('id') id: string,
    @Body() dto: LockDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.users.setLock(actor, id, dto.locked, dto.reason ?? null, req);
    return { ok: true };
  }

  @Post(':id/force-logout')
  @HttpCode(200)
  async forceLogout(
    @Param('id') id: string,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.users.forceLogout(actor, id, req);
    return { ok: true };
  }
}

/* ---------- 학번 화이트리스트 ---------- */

@Controller('admin/whitelist')
@UseGuards(AdminGuard)
export class AdminWhitelistController {
  constructor(private readonly whitelist: WhitelistService) {}

  @Get()
  list(): Promise<WhitelistRow[]> {
    return this.whitelist.list();
  }

  @Post()
  add(
    @Body() dto: WhitelistAddDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ): Promise<{ added: number; promoted: number; invalid: string[] }> {
    return this.whitelist.add(actor, dto.studentIds, dto.generation, dto.note, req);
  }

  @Delete(':studentId')
  remove(
    @Param('studentId') studentId: string,
    @Query('reason') reason: string | undefined,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ): Promise<{ demoted: boolean }> {
    return this.whitelist.remove(actor, studentId, reason ?? null, req);
  }
}

/* ---------- 접속 · 감사 로그 ---------- */

@Controller('admin/logs')
@UseGuards(AdminGuard)
export class AdminLogsController {
  constructor(
    private readonly logsQuery: LogsQueryService,
    private readonly logs: LogsService,
  ) {}

  @Get('access')
  access(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  ) {
    return this.logsQuery.access({ from, to, action, q, page });
  }

  @Get('audit')
  audit(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  ) {
    return this.logsQuery.audit({ from, to, action, q, page });
  }

  // 내보내기는 elevated 세션 필요 (§8-2)
  @Get(':kind/export')
  @UseGuards(ElevatedGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @Param('kind') kind: string,
    @CurrentUser() actor: User,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const k = kind === 'audit' ? 'audit' : 'access';
    void this.logs.audit(actor.id, 'EXPORT', req, { targetType: 'Logs', targetId: k });
    res.setHeader('Content-Disposition', `attachment; filename="sowl-${k}-logs.csv"`);
    res.send(await this.logsQuery.exportCsv(k));
  }
}

/* ---------- 서버랙 ---------- */

@Controller('admin/rack')
@UseGuards(AdminGuard)
export class AdminRackController {
  constructor(private readonly rack: RackService) {}

  @Get()
  list() {
    return this.rack.list();
  }

  @Post()
  create(@Body() dto: RackCreateDto) {
    return this.rack.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: RackUpdateDto) {
    return this.rack.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rack.remove(id);
  }

  @Post(':id/ping')
  @HttpCode(200)
  ping(@Param('id') id: string) {
    return this.rack.ping(id);
  }
}

/* ---------- 사이트 설정 ---------- */

@Controller('admin/settings')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SiteSettings> {
    return this.settings.get();
  }

  @Patch()
  patch(
    @Body() dto: SettingsDto,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ): Promise<SiteSettings> {
    return this.settings.patch(actor, dto, req);
  }
}

/* ---------- DB 콘솔 (§8 elevated) ---------- */

@Controller('admin/db')
@UseGuards(AdminGuard)
export class AdminDbController {
  constructor(private readonly db: DbConsoleService) {}

  @Post('unlock')
  @HttpCode(200)
  unlock(
    @Body() dto: UnlockDto,
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.db.unlock(user, dto.passphrase, req, res);
  }

  @Post('query')
  @HttpCode(200)
  @UseGuards(ElevatedGuard)
  query(@Body() dto: QueryDto) {
    return this.db.query(dto.sql);
  }
}
