import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  type ProjectRow,
  type ProjectStatus,
  type TeamPostRow,
} from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------- 프로젝트 ---------- */

  async list(status?: ProjectStatus, q?: string): Promise<ProjectRow[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { summary: { contains: q, mode: 'insensitive' as const } },
                { techStack: { has: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        owner: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      description: p.description,
      status: p.status as ProjectStatus,
      techStack: p.techStack,
      repoUrl: p.repoUrl,
      demoUrl: p.demoUrl,
      generation: p.generation,
      ownerId: p.ownerId,
      ownerName: p.owner.name,
      members: p.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
      startedAt: p.startedAt?.toISOString() ?? null,
      endedAt: p.endedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  create(
    ownerId: string,
    data: {
      name: string;
      summary: string;
      description?: string;
      status?: ProjectStatus;
      techStack?: string[];
      repoUrl?: string;
      demoUrl?: string;
      generation?: number;
    },
  ) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        summary: data.summary,
        description: data.description ?? null,
        status: data.status ?? 'ONGOING',
        techStack: data.techStack ?? [],
        repoUrl: data.repoUrl ?? null,
        demoUrl: data.demoUrl ?? null,
        generation: data.generation ?? null,
        ownerId,
        startedAt: new Date(),
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
  }

  private async assertOwner(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const p = await this.prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (!p) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '프로젝트를 찾을 수 없습니다.',
      });
    }
    if (p.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '프로젝트 담당자만 수정할 수 있습니다.',
      });
    }
  }

  async update(
    id: string,
    userId: string,
    isAdmin: boolean,
    data: Partial<{
      name: string;
      summary: string;
      description: string;
      status: ProjectStatus;
      techStack: string[];
      repoUrl: string;
      demoUrl: string;
    }>,
  ) {
    await this.assertOwner(id, userId, isAdmin);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === 'DONE' ? { endedAt: new Date() } : {}),
      },
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    await this.assertOwner(id, userId, isAdmin);
    await this.prisma.project.delete({ where: { id } });
  }

  /* ---------- 팀원 모집 ---------- */

  async teamPosts(
    userId: string,
    filters: { status?: string; position?: string; tech?: string } = {},
  ): Promise<TeamPostRow[]> {
    const posts = await this.prisma.teamPost.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.position ? { positions: { has: filters.position } } : {}),
        ...(filters.tech ? { techStack: { has: filters.tech } } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        applications: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      positions: p.positions,
      techStack: p.techStack,
      status: p.status as 'OPEN' | 'CLOSED',
      projectId: p.projectId,
      projectName: p.project?.name ?? null,
      authorId: p.authorId,
      authorName: p.author.name,
      applicationCount: p.applications.length,
      appliedByMe: p.applications.some((a) => a.userId === userId),
      createdAt: p.createdAt.toISOString(),
      // 지원자 명단은 글쓴이에게만
      applications:
        p.authorId === userId
          ? p.applications.map((a) => ({
              id: a.id,
              userId: a.user.id,
              userName: a.user.name,
              position: a.position,
              message: a.message,
              status: a.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
              createdAt: a.createdAt.toISOString(),
            }))
          : [],
    }));
  }

  createTeamPost(
    authorId: string,
    data: {
      title: string;
      body: string;
      positions?: string[];
      techStack?: string[];
      projectId?: string;
    },
  ) {
    return this.prisma.teamPost.create({
      data: {
        title: data.title,
        body: data.body,
        positions: data.positions ?? [],
        techStack: data.techStack ?? [],
        projectId: data.projectId || null,
        authorId,
      },
    });
  }

  async apply(postId: string, userId: string, message: string, position?: string) {
    const post = await this.prisma.teamPost.findUnique({
      where: { id: postId },
      select: { status: true, authorId: true },
    });
    if (!post) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '모집글을 찾을 수 없습니다.',
      });
    }
    if (post.status === 'CLOSED') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '마감된 모집글입니다.',
      });
    }
    if (post.authorId === userId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '본인이 올린 모집글에는 지원할 수 없습니다.',
      });
    }
    return this.prisma.teamApplication.upsert({
      where: { postId_userId: { postId, userId } },
      update: { message, position: position ?? null, status: 'PENDING' },
      create: { postId, userId, message, position: position ?? null },
    });
  }

  /** 수락하면 연결된 프로젝트가 있을 때 팀원으로 등록한다 */
  async decideApplication(
    applicationId: string,
    ownerId: string,
    isAdmin: boolean,
    accept: boolean,
  ): Promise<void> {
    const app = await this.prisma.teamApplication.findUnique({
      where: { id: applicationId },
      include: { post: { select: { authorId: true, projectId: true } } },
    });
    if (!app) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '지원 내역을 찾을 수 없습니다.',
      });
    }
    if (app.post.authorId !== ownerId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '모집글 작성자만 처리할 수 있습니다.',
      });
    }
    await this.prisma.teamApplication.update({
      where: { id: applicationId },
      data: { status: accept ? 'ACCEPTED' : 'REJECTED' },
    });
    if (accept && app.post.projectId) {
      await this.prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: app.post.projectId, userId: app.userId } },
        update: {},
        create: {
          projectId: app.post.projectId,
          userId: app.userId,
          role: app.position || 'MEMBER',
        },
      });
    }
  }

  async closeTeamPost(id: string, userId: string, isAdmin: boolean) {
    const post = await this.prisma.teamPost.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });
    if (!post) return null;
    if (post.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '작성자만 마감할 수 있습니다.',
      });
    }
    return this.prisma.teamPost.update({
      where: { id },
      data: { status: post.status === 'OPEN' ? 'CLOSED' : 'OPEN' },
    });
  }

  async removeTeamPost(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const post = await this.prisma.teamPost.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post) return;
    if (post.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '작성자만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.teamPost.delete({ where: { id } });
  }
}
