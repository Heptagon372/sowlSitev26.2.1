import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // 로컬 DB(embedded-postgres / docker)가 늦게 뜨는 경우를 위해 재시도
    const maxRetries = 30;
    for (let i = 1; i <= maxRetries; i++) {
      try {
        await this.$connect();
        return;
      } catch (e) {
        if (i === maxRetries) throw e;
        this.logger.warn(`DB 연결 대기 중... (${i}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
