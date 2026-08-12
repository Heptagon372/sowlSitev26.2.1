import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, type StudyDetail, type StudyRow, type StudyStatus } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

const listInclude = {
  leader: { select: { id: true, name: true } },
  members: { select: { userId: true } },
} as const;

@Injectable()
export class StudiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, status?: StudyStatus, q?: string): Promise<StudyRow[]> {
    const studies = await this.prisma.study.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { topic: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: listInclude,
    });
    return studies.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      topic: s.topic,
      status: s.status as StudyStatus,
      schedule: s.schedule,
      maxMembers: s.maxMembers,
      memberCount: s.members.length,
      leaderId: s.leaderId,
      leaderName: s.leader.name,
      joinedByMe: s.members.some((m) => m.userId === userId),
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async detail(id: string, userId: string): Promise<StudyDetail> {
    const s = await this.prisma.study.findUnique({
      where: { id },
      include: {
        leader: { select: { id: true, name: true } },
        members: {
          orderBy: { joinedAt: 'asc' },
          include: { user: { select: { id: true, name: true, generation: true } } },
        },
        weeks: { orderBy: { weekNo: 'asc' } },
        _count: { select: { files: true } },
      },
    });
    if (!s) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '스터디를 찾을 수 없습니다.',
      });
    }
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      topic: s.topic,
      status: s.status as StudyStatus,
      schedule: s.schedule,
      maxMembers: s.maxMembers,
      memberCount: s.members.length,
      leaderId: s.leaderId,
      leaderName: s.leader.name,
      joinedByMe: s.members.some((m) => m.userId === userId),
      createdAt: s.createdAt.toISOString(),
      members: s.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        generation: m.user.generation,
        isLeader: m.userId === s.leaderId,
      })),
      weeks: s.weeks.map((w) => ({
        id: w.id,
        weekNo: w.weekNo,
        title: w.title,
        content: w.content,
        meetAt: w.meetAt?.toISOString() ?? null,
        done: w.done,
      })),
      fileCount: s._count.files,
    };
  }

  /** 개설자는 자동으로 스터디장 겸 첫 멤버 */
  async create(
    leaderId: string,
    data: {
      title: string;
      description: string;
      topic?: string;
      schedule?: string;
      maxMembers?: number;
      generation?: number;
    },
  ) {
    return this.prisma.study.create({
      data: {
        title: data.title,
        description: data.description,
        topic: data.topic ?? null,
        schedule: data.schedule ?? null,
        maxMembers: data.maxMembers ?? 8,
        generation: data.generation ?? null,
        leaderId,
        members: { create: { userId: leaderId } },
      },
    });
  }

  async join(id: string, userId: string): Promise<void> {
    const study = await this.prisma.study.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!study) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '스터디를 찾을 수 없습니다.',
      });
    }
    if (study.status === 'DONE') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '이미 종료된 스터디입니다.',
      });
    }
    if (study._count.members >= study.maxMembers) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '정원이 가득 찼습니다.',
      });
    }
    await this.prisma.studyMember.upsert({
      where: { studyId_userId: { studyId: id, userId } },
      update: {},
      create: { studyId: id, userId },
    });
  }

  /** 스터디장은 나갈 수 없다 (넘기거나 스터디를 종료해야 한다) */
  async leave(id: string, userId: string): Promise<void> {
    const study = await this.prisma.study.findUnique({ where: { id }, select: { leaderId: true } });
    if (!study) return;
    if (study.leaderId === userId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '스터디장은 탈퇴할 수 없습니다. 스터디를 종료하거나 관리자에게 문의하세요.',
      });
    }
    await this.prisma.studyMember
      .delete({ where: { studyId_userId: { studyId: id, userId } } })
      .catch(() => undefined);
  }

  private async assertLeader(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const study = await this.prisma.study.findUnique({ where: { id }, select: { leaderId: true } });
    if (!study) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '스터디를 찾을 수 없습니다.',
      });
    }
    if (study.leaderId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '스터디장만 수정할 수 있습니다.',
      });
    }
  }

  async setStatus(id: string, status: StudyStatus, userId: string, isAdmin: boolean) {
    await this.assertLeader(id, userId, isAdmin);
    return this.prisma.study.update({ where: { id }, data: { status } });
  }

  async addWeek(
    id: string,
    userId: string,
    isAdmin: boolean,
    data: { title: string; content?: string; meetAt?: string },
  ) {
    await this.assertLeader(id, userId, isAdmin);
    const last = await this.prisma.studyWeek.findFirst({
      where: { studyId: id },
      orderBy: { weekNo: 'desc' },
      select: { weekNo: true },
    });
    return this.prisma.studyWeek.create({
      data: {
        studyId: id,
        weekNo: (last?.weekNo ?? 0) + 1,
        title: data.title,
        content: data.content ?? null,
        meetAt: data.meetAt ? new Date(data.meetAt) : null,
      },
    });
  }

  async toggleWeek(weekId: string, userId: string, isAdmin: boolean) {
    const week = await this.prisma.studyWeek.findUnique({
      where: { id: weekId },
      select: { studyId: true, done: true },
    });
    if (!week) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '주차를 찾을 수 없습니다.',
      });
    }
    await this.assertLeader(week.studyId, userId, isAdmin);
    return this.prisma.studyWeek.update({
      where: { id: weekId },
      data: { done: !week.done },
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    await this.assertLeader(id, userId, isAdmin);
    await this.prisma.study.delete({ where: { id } });
  }
}
