import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ERROR_CODES,
  type AdminApplicationDetail,
  type AdminApplicationRow,
  type AdminListResult,
} from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminListQuery {
  q?: string;
  interest?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private where(query: AdminListQuery): Prisma.ApplicationWhereInput {
    const where: Prisma.ApplicationWhereInput = {};
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { studentId: { contains: query.q } },
      ];
    }
    if (query.interest) {
      where.interests = { has: query.interest };
    }
    return where;
  }

  async list(query: AdminListQuery): Promise<AdminListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 100));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [items, total, today, allInterests] = await Promise.all([
      this.prisma.application.findMany({
        where: this.where(query),
        orderBy: { createdAt: query.order ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where: this.where(query) }),
      this.prisma.application.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.application.findMany({ select: { interests: true } }),
    ]);

    const interestDist: Record<string, number> = {};
    for (const row of allInterests) {
      for (const i of row.interests) {
        interestDist[i] = (interestDist[i] ?? 0) + 1;
      }
    }

    const rows: AdminApplicationRow[] = items.map((a) => ({
      id: a.id,
      generation: a.generation,
      name: a.name,
      studentId: a.studentId,
      department: a.department,
      grade: a.grade,
      interests: a.interests,
      experience: a.experience,
      createdAt: a.createdAt.toISOString(),
    }));

    return { total, today, interestDist, items: rows };
  }

  async detail(id: string): Promise<AdminApplicationDetail> {
    const a = await this.prisma.application.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '지원서를 찾을 수 없습니다.',
      });
    }
    return {
      id: a.id,
      generation: a.generation,
      name: a.name,
      studentId: a.studentId,
      department: a.department,
      grade: a.grade,
      phone: a.phone,
      email: a.email,
      interests: a.interests,
      experience: a.experience,
      availableDays: a.availableDays,
      motivation: a.motivation,
      wantToBuild: a.wantToBuild,
      agreedAt: a.agreedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** UTF-8 BOM CSV — 엑셀에서 한글이 깨지지 않도록 한다 */
  async exportCsv(): Promise<string> {
    const rows = await this.prisma.application.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const header = [
      '기수',
      '이름',
      '학번',
      '학과',
      '학년',
      '연락처',
      '이메일',
      '관심분야',
      '개발경험',
      '활동가능요일',
      '지원동기',
      '만들어보고싶은것',
      '개인정보동의일시',
      '제출일시',
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((a) =>
      [
        String(a.generation),
        a.name,
        a.studentId,
        a.department,
        a.grade,
        a.phone,
        a.email,
        a.interests.join(' | '),
        a.experience,
        a.availableDays.join(' | '),
        a.motivation,
        a.wantToBuild ?? '',
        a.agreedAt.toISOString(),
        a.createdAt.toISOString(),
      ]
        .map(esc)
        .join(','),
    );
    return String.fromCharCode(0xfeff) + [header.map(esc).join(','), ...lines].join('\r\n');
  }
}
