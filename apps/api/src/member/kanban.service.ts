import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type KanbanBoard, type TaskStatus } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

/** #12 프로젝트 관리 — 칸반 보드 · 마일스톤 · 담당자 */
@Injectable()
export class KanbanService {
  constructor(private readonly prisma: PrismaService) {}

  /** 보드 수정 권한: 프로젝트 담당자 · 팀원 · 관리자 */
  private async assertMember(projectId: string, userId: string, isAdmin: boolean): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { where: { userId }, select: { userId: true } } },
    });
    if (!project) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '프로젝트를 찾을 수 없습니다.',
      });
    }
    if (project.ownerId !== userId && project.members.length === 0 && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '프로젝트 팀원만 보드를 수정할 수 있습니다.',
      });
    }
  }

  async board(projectId: string, userId: string, isAdmin: boolean): Promise<KanbanBoard> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
        milestones: {
          orderBy: [{ done: 'asc' }, { dueAt: 'asc' }],
          include: { tasks: { select: { status: true } } },
        },
        tasks: {
          orderBy: [{ status: 'asc' }, { order: 'asc' }],
          include: {
            assignee: { select: { id: true, name: true } },
            milestone: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '프로젝트를 찾을 수 없습니다.',
      });
    }
    return {
      projectId: project.id,
      projectName: project.name,
      canManage:
        project.ownerId === userId ||
        project.members.some((m) => m.userId === userId) ||
        isAdmin,
      members: project.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
      milestones: project.milestones.map((ms) => ({
        id: ms.id,
        title: ms.title,
        dueAt: ms.dueAt?.toISOString() ?? null,
        done: ms.done,
        taskCount: ms.tasks.length,
        doneCount: ms.tasks.filter((t) => t.status === 'DONE').length,
      })),
      tasks: project.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        status: t.status as TaskStatus,
        order: t.order,
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.name ?? null,
        milestoneId: t.milestoneId,
        milestoneTitle: t.milestone?.title ?? null,
        dueAt: t.dueAt?.toISOString() ?? null,
      })),
    };
  }

  async createTask(
    projectId: string,
    userId: string,
    isAdmin: boolean,
    data: {
      title: string;
      body?: string;
      status?: TaskStatus;
      assigneeId?: string;
      milestoneId?: string;
      dueAt?: string;
    },
  ) {
    await this.assertMember(projectId, userId, isAdmin);
    const last = await this.prisma.projectTask.findFirst({
      where: { projectId, status: data.status ?? 'TODO' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.projectTask.create({
      data: {
        projectId,
        title: data.title,
        body: data.body ?? null,
        status: data.status ?? 'TODO',
        order: (last?.order ?? 0) + 1,
        assigneeId: data.assigneeId || null,
        milestoneId: data.milestoneId || null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      },
    });
  }

  async updateTask(
    taskId: string,
    userId: string,
    isAdmin: boolean,
    data: {
      title?: string;
      body?: string | null;
      status?: TaskStatus;
      order?: number;
      assigneeId?: string | null;
      milestoneId?: string | null;
      dueAt?: string | null;
    },
  ) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '태스크를 찾을 수 없습니다.',
      });
    }
    await this.assertMember(task.projectId, userId, isAdmin);
    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId || null } : {}),
        ...(data.milestoneId !== undefined ? { milestoneId: data.milestoneId || null } : {}),
        ...(data.dueAt !== undefined
          ? { dueAt: data.dueAt ? new Date(data.dueAt) : null }
          : {}),
      },
    });
  }

  async removeTask(taskId: string, userId: string, isAdmin: boolean): Promise<void> {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) return;
    await this.assertMember(task.projectId, userId, isAdmin);
    await this.prisma.projectTask.delete({ where: { id: taskId } });
  }

  async createMilestone(
    projectId: string,
    userId: string,
    isAdmin: boolean,
    data: { title: string; dueAt?: string },
  ) {
    await this.assertMember(projectId, userId, isAdmin);
    return this.prisma.milestone.create({
      data: {
        projectId,
        title: data.title,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      },
    });
  }

  async toggleMilestone(id: string, userId: string, isAdmin: boolean) {
    const ms = await this.prisma.milestone.findUnique({
      where: { id },
      select: { projectId: true, done: true },
    });
    if (!ms) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '마일스톤을 찾을 수 없습니다.',
      });
    }
    await this.assertMember(ms.projectId, userId, isAdmin);
    return this.prisma.milestone.update({ where: { id }, data: { done: !ms.done } });
  }

  async removeMilestone(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const ms = await this.prisma.milestone.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!ms) return;
    await this.assertMember(ms.projectId, userId, isAdmin);
    await this.prisma.milestone.delete({ where: { id } });
  }
}
