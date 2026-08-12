import { Module } from '@nestjs/common';
import { RecruitController } from './recruit.controller';
import { RecruitService } from './recruit.service';

@Module({
  controllers: [RecruitController],
  providers: [RecruitService],
  exports: [RecruitService],
})
export class RecruitModule {}
