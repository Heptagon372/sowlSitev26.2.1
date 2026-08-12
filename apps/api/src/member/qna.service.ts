import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type QuestionDetail, type QuestionRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QnaService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { q?: string; tag?: string; unsolved?: boolean }): Promise<QuestionRow[]> {
    const questions = await this.prisma.question.findMany({
      where: {
        ...(filter.q
          ? {
              OR: [
                { title: { contains: filter.q, mode: 'insensitive' as const } },
                { body: { contains: filter.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(filter.tag ? { tags: { has: filter.tag } } : {}),
        ...(filter.unsolved ? { acceptedAnswerId: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { answers: true } },
      },
    });
    return questions.map((q) => ({
      id: q.id,
      title: q.title,
      tags: q.tags,
      authorId: q.authorId,
      authorName: q.author.name,
      answerCount: q._count.answers,
      solved: !!q.acceptedAnswerId,
      views: q.views,
      createdAt: q.createdAt.toISOString(),
    }));
  }

  async detail(id: string): Promise<QuestionDetail> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        answers: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });
    if (!q) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '질문을 찾을 수 없습니다.',
      });
    }
    await this.prisma.question.update({ where: { id }, data: { views: { increment: 1 } } });
    return {
      id: q.id,
      title: q.title,
      body: q.body,
      tags: q.tags,
      authorId: q.authorId,
      authorName: q.author.name,
      answerCount: q.answers.length,
      solved: !!q.acceptedAnswerId,
      views: q.views + 1,
      createdAt: q.createdAt.toISOString(),
      answers: q.answers.map((a) => ({
        id: a.id,
        authorId: a.authorId,
        authorName: a.author.name,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
        accepted: a.id === q.acceptedAnswerId,
      })),
    };
  }

  ask(authorId: string, data: { title: string; body: string; tags?: string[] }) {
    return this.prisma.question.create({
      data: {
        title: data.title,
        body: data.body,
        tags: (data.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 5),
        authorId,
      },
    });
  }

  answer(questionId: string, authorId: string, body: string) {
    return this.prisma.answer.create({ data: { questionId, authorId, body } });
  }

  /** 채택 — 질문자만. 이미 채택된 답변을 다시 누르면 채택 해제. */
  async accept(questionId: string, answerId: string, userId: string): Promise<void> {
    const q = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { authorId: true, acceptedAnswerId: true },
    });
    if (!q) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '질문을 찾을 수 없습니다.',
      });
    }
    if (q.authorId !== userId) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '질문한 사람만 답변을 채택할 수 있습니다.',
      });
    }
    await this.prisma.question.update({
      where: { id: questionId },
      data: { acceptedAnswerId: q.acceptedAnswerId === answerId ? null : answerId },
    });
  }

  async removeQuestion(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const q = await this.prisma.question.findUnique({ where: { id }, select: { authorId: true } });
    if (!q) return;
    if (q.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '본인 질문만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.question.delete({ where: { id } });
  }

  async removeAnswer(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const a = await this.prisma.answer.findUnique({ where: { id }, select: { authorId: true } });
    if (!a) return;
    if (a.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '본인 답변만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.answer.delete({ where: { id } });
  }
}
