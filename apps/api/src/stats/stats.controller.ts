import { Controller, Get } from '@nestjs/common';
import type { ClubStats } from '@sowl/shared';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  getStats(): Promise<ClubStats> {
    return this.stats.getStats();
  }
}
