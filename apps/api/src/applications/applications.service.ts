import { ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES, type ApplicationResult } from '@sowl/shared';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RecruitService } from '../recruit/recruit.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recruit: RecruitService,
  ) {}

  async submit(
    dto: CreateApplicationDto,
    ip: string | undefined,
    userId: string | null = null,
  ): Promise<ApplicationResult> {
    const info = await this.recruit.getInfo();
    if (info.phase !== 'open') {
      throw new ForbiddenException({
        code: ERROR_CODES.RECRUIT_CLOSED,
        message:
          info.phase === 'before'
            ? '아직 모집 시작 전입니다.'
            : '모집이 마감되었습니다.',
      });
    }

    const now = new Date();
    // 원본 IP는 저장하지 않는다 — 중복 제출 감지용 해시만 보관
    const ipHash = ip ? createHash('sha256').update(`sowl:${ip}`).digest('hex') : null;

    const data = {
      generation: info.generation,
      name: dto.applicant.name,
      studentId: dto.applicant.studentId,
      department: dto.applicant.department,
      grade: dto.applicant.grade,
      phone: dto.applicant.phone,
      email: dto.applicant.email,
      interests: dto.interests,
      experience: dto.experience,
      availableDays: dto.availableDays ?? [],
      motivation: dto.motivation,
      wantToBuild: dto.wantToBuild ?? null,
      agreedAt: now,
      ipHash,
      userId,
    };

    // 같은 기수 + 같은 학번 → 기존 레코드 갱신
    const existing = await this.prisma.application.findUnique({
      where: {
        generation_studentId: {
          generation: info.generation,
          studentId: dto.applicant.studentId,
        },
      },
      select: { id: true },
    });

    const saved = await this.prisma.application.upsert({
      where: {
        generation_studentId: {
          generation: info.generation,
          studentId: dto.applicant.studentId,
        },
      },
      // 비로그인 재제출이 기존 계정 연결을 지우지 않도록 null이면 유지
      update: { ...data, userId: userId ?? undefined },
      create: data,
    });

    return {
      id: saved.id,
      submittedAt: now.toISOString(),
      updated: existing !== null,
    };
  }
}
