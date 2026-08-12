import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type NoticeDetail, type NoticeRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, take = 50): Promise<NoticeRow[]> {
    const notices = await this.prisma.notice.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take,
      include: {
        author: { select: { name: true } },
        reads: { where: { userId }, select: { userId: true } },
      },
    });
    return notices.map((n) => ({
      id: n.id,
      title: n.title,
      pinned: n.pinned,
      authorName: n.author.name,
      createdAt: n.createdAt.toISOString(),
      read: n.reads.length > 0,
    }));
  }

  /** 상세 조회 — 읽음 표시를 함께 남긴다 */
  async detail(id: string, userId: string): Promise<NoticeDetail> {
    const n = await this.prisma.notice.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });
    if (!n) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '공지를 찾을 수 없습니다.',
      });
    }
    await this.prisma.noticeRead.upsert({
      where: { noticeId_userId: { noticeId: id, userId } },
      update: {},
      create: { noticeId: id, userId },
    });
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      authorName: n.author.name,
      createdAt: n.createdAt.toISOString(),
      read: true,
    };
  }

  create(authorId: string, data: { title: string; body: string; pinned?: boolean }) {
    return this.prisma.notice.create({
      data: { ...data, pinned: data.pinned ?? false, authorId },
    });
  }

  update(id: string, data: { title?: string; body?: string; pinned?: boolean }) {
    return this.prisma.notice.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.notice.delete({ where: { id } });
  }
}
