import { Controller, Get } from '@nestjs/common';
import type { RecruitInfo } from '@sowl/shared';
import { RecruitService } from './recruit.service';

@Controller('recruit')
export class RecruitController {
  constructor(private readonly recruit: RecruitService) {}

  @Get()
  getInfo(): Promise<RecruitInfo> {
    return this.recruit.getInfo();
  }
}
