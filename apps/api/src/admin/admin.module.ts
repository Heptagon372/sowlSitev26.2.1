import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {
  AdminDashboardController,
  AdminDbController,
  AdminLogsController,
  AdminRackController,
  AdminSettingsController,
  AdminUsersController,
  AdminWhitelistController,
} from './admin-extra.controllers';
import { DbConsoleService } from './db.service';
import { LogsQueryService } from './logs-query.service';
import { RackService } from './rack.service';
import { SettingsService } from './settings.service';
import { UsersService } from './users.service';
import { WhitelistService } from './whitelist.service';

/** 관리자 API (/api/admin/**) — 전부 ADMIN, 위험 작업은 elevated 세션 추가 */
@Module({
  controllers: [
    AdminController,
    AdminDashboardController,
    AdminUsersController,
    AdminWhitelistController,
    AdminLogsController,
    AdminRackController,
    AdminSettingsController,
    AdminDbController,
  ],
  providers: [
    AdminService,
    UsersService,
    WhitelistService,
    LogsQueryService,
    RackService,
    SettingsService,
    DbConsoleService,
  ],
})
export class AdminModule {}
