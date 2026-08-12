import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type CommunityHub,
  type PortfolioItem,
  type ProjectStatus,
} from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PollsService } from './polls.service';
import { PostsService } from './posts.service';
import { QnaService } from './qna.service';

/** #16 포트폴리오 + #17 커뮤니티 허브 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly qna: QnaService,
    private readonly polls: PollsService,
  ) {}

  /** 완성작 갤러리 — 완료/보관된 프로젝트 위주, 공개 플래그는 외부 노출 대비 */
  async gallery(userId: string, isAdmin: boolean, onlyPublic = false): Promise<PortfolioItem[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        ...(onlyPublic ? { isPublic: true } : {}),
        status: { in: ['DONE', 'ARCHIVED', 'ONGOING'] },
      },
      orderBy: [{ endedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        owner: { select: { id: true, name: true } },
        members: { include: { user: { select: { name: true } } } },
      },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      description: p.description,
      techStack: p.techStack,
      repoUrl: p.repoUrl,
      demoUrl: p.demoUrl,
      thumbnailUrl: p.thumbnailUrl,
      generation: p.generation,
      status: p.status as ProjectStatus,
      ownerName: p.owner.name,
      memberNames: p.members.map((m) => m.user.name),
      endedAt: p.endedAt?.toISOString() ?? null,
      isPublic: p.isPublic,
      canManage: p.ownerId === userId || isAdmin,
    }));
  }

  async setPublic(projectId: string, userId: string, isAdmin: boolean, isPublic: boolean) {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!p) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '프로젝트를 찾을 수 없습니다.',
      });
    }
    if (p.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '프로젝트 담당자만 공개 설정을 바꿀 수 있습니다.',
      });
    }
    return this.prisma.project.update({ where: { id: projectId }, data: { isPublic } });
  }

  setThumbnail(projectId: string, thumbnailUrl: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { thumbnailUrl: thumbnailUrl || null },
    });
  }

  /** 커뮤니티 허브 — 게시판·Q&A·설문·채팅 최신을 한 화면에 모은다 */
  async hub(userId: string): Promise<CommunityHub> {
    const [posts, questions, polls, chat, counts] = await Promise.all([
      this.posts.list(userId, 1, 6),
      this.qna.list({}),
      this.polls.list(userId),
      this.prisma.chatMessage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { name: true } },
          room: { select: { name: true, slug: true } },
        },
      }),
      Promise.all([
        this.prisma.post.count(),
        this.prisma.question.count(),
        this.prisma.poll.count(),
        this.prisma.question.count({ where: { acceptedAnswerId: null } }),
      ]),
    ]);

    return {
      posts: posts.items,
      questions: questions.slice(0, 6),
      polls: polls.slice(0, 3),
      latestChat: chat.map((c) => ({
        room: c.room.name,
        roomSlug: c.room.slug,
        body: c.body.slice(0, 80),
        userName: c.user.name,
        at: c.createdAt.toISOString(),
      })),
      counts: {
        posts: counts[0],
        questions: counts[1],
        polls: counts[2],
        unsolved: counts[3],
      },
    };
  }
}
