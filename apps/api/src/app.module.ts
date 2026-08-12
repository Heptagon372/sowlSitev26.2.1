import { Controller, Get, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RecruitModule } from './recruit/recruit.module';
import { StatsModule } from './stats/stats.module';
import { ApplicationsModule } from './applications/applications.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { MemberModule } from './member/member.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    // 민감 엔드포인트는 IP 단위 제한 (컨트롤러에서 @UseGuards(ThrottlerGuard))
    ThrottlerModule.forRoot([{ ttl: 600_000, limit: 5 }]),
    PrismaModule,
    AuthModule,
    RecruitModule,
    StatsModule,
    ApplicationsModule,
    MemberModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
