import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, type PollRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<PollRow[]> {
    const polls = await this.prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        author: { select: { id: true, name: true } },
        options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } },
        votes: { select: { userId: true, optionId: true } },
      },
    });

    return polls.map((p) => {
      // 응답자 수 = 중복 제거한 사람 수 (복수 선택이어도 1명)
      const voters = new Set(p.votes.map((v) => v.userId));
      const total = voters.size;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        multiple: p.multiple,
        anonymous: p.anonymous,
        closesAt: p.closesAt?.toISOString() ?? null,
        closed: !!p.closesAt && p.closesAt < new Date(),
        authorId: p.authorId,
        authorName: p.author.name,
        createdAt: p.createdAt.toISOString(),
        totalVoters: total,
        myVotes: p.votes.filter((v) => v.userId === userId).map((v) => v.optionId),
        options: p.options.map((o) => ({
          id: o.id,
          label: o.label,
          count: o._count.votes,
          percent: total ? Math.round((o._count.votes / total) * 100) : 0,
        })),
      };
    });
  }

  create(
    authorId: string,
    data: {
      title: string;
      description?: string;
      options: string[];
      multiple?: boolean;
      anonymous?: boolean;
      closesAt?: string;
    },
  ) {
    const options = data.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '선택지를 2개 이상 입력해 주세요.',
      });
    }
    return this.prisma.poll.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        multiple: data.multiple ?? false,
        anonymous: data.anonymous ?? true,
        closesAt: data.closesAt ? new Date(data.closesAt) : null,
        authorId,
        options: { create: options.map((label, order) => ({ label, order })) },
      },
    });
  }

  /** 투표 — 단일 선택이면 기존 표를 갈아치우고, 복수면 토글한다 */
  async vote(pollId: string, optionId: string, userId: string): Promise<void> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { select: { id: true } } },
    });
    if (!poll) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '설문을 찾을 수 없습니다.',
      });
    }
    if (poll.closesAt && poll.closesAt < new Date()) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '마감된 설문입니다.',
      });
    }
    if (!poll.options.some((o) => o.id === optionId)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '없는 선택지입니다.',
      });
    }

    const existing = await this.prisma.pollVote.findUnique({
      where: { optionId_userId: { optionId, userId } },
    });
    if (existing) {
      await this.prisma.pollVote.delete({ where: { id: existing.id } });
      return;
    }
    if (!poll.multiple) {
      await this.prisma.pollVote.deleteMany({ where: { pollId, userId } });
    }
    await this.prisma.pollVote.create({ data: { pollId, optionId, userId } });
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const poll = await this.prisma.poll.findUnique({ where: { id }, select: { authorId: true } });
    if (!poll) return;
    if (poll.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '본인이 만든 설문만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.poll.delete({ where: { id } });
  }

  /** 기명 설문의 응답자 명단 (설문 작성자·관리자용) */
  async voters(
    pollId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<Array<{ optionLabel: string; names: string[] }>> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { order: 'asc' },
          include: { votes: { include: { user: { select: { name: true } } } } },
        },
      },
    });
    if (!poll) return [];
    if (poll.anonymous && poll.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '익명 설문의 응답자는 볼 수 없습니다.',
      });
    }
    return poll.options.map((o) => ({
      optionLabel: o.label,
      names: o.votes.map((v) => v.user.name),
    }));
  }
}
