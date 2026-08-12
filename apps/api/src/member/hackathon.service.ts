import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, type HackathonRow, type HackathonStatus } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

/** #15 해커톤 — 회차 정보 · 팀 편성 · 결과물 제출 */
@Injectable()
export class HackathonService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<HackathonRow[]> {
    const rounds = await this.prisma.hackathon.findMany({
      orderBy: { startsAt: 'desc' },
      include: {
        teams: {
          orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
          include: { members: { include: { user: { select: { id: true, name: true } } } } },
        },
      },
    });
    return rounds.map((h) => {
      const teams = h.teams.map((t) => ({
        id: t.id,
        name: t.name,
        idea: t.idea,
        repoUrl: t.repoUrl,
        demoUrl: t.demoUrl,
        submittedAt: t.submittedAt?.toISOString() ?? null,
        score: t.score,
        rank: t.rank,
        members: t.members.map((m) => ({ id: m.user.id, name: m.user.name })),
        joinedByMe: t.members.some((m) => m.userId === userId),
      }));
      return {
        id: h.id,
        round: h.round,
        title: h.title,
        theme: h.theme,
        description: h.description,
        startsAt: h.startsAt.toISOString(),
        endsAt: h.endsAt.toISOString(),
        location: h.location,
        status: h.status as HackathonStatus,
        teams,
        myTeamId: teams.find((t) => t.joinedByMe)?.id ?? null,
      };
    });
  }

  create(data: {
    round: number;
    title: string;
    theme?: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    location?: string;
    status?: HackathonStatus;
  }) {
    return this.prisma.hackathon.create({
      data: {
        round: data.round,
        title: data.title,
        theme: data.theme ?? null,
        description: data.description ?? null,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        location: data.location ?? null,
        status: data.status ?? 'PLANNED',
      },
    });
  }

  setStatus(id: string, status: HackathonStatus) {
    return this.prisma.hackathon.update({ where: { id }, data: { status } });
  }

  remove(id: string) {
    return this.prisma.hackathon.delete({ where: { id } });
  }

  /** 팀 만들기 — 회차당 한 팀만. 만든 사람이 첫 팀원이 된다. */
  async createTeam(hackathonId: string, userId: string, name: string, idea?: string) {
    const h = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: { status: true },
    });
    if (!h) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '해커톤을 찾을 수 없습니다.',
      });
    }
    if (h.status === 'DONE') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '종료된 해커톤입니다.',
      });
    }
    await this.assertNotInAnyTeam(hackathonId, userId);
    return this.prisma.hackathonTeam.create({
      data: {
        hackathonId,
        name,
        idea: idea ?? null,
        members: { create: { userId } },
      },
    });
  }

  private async assertNotInAnyTeam(hackathonId: string, userId: string): Promise<void> {
    const already = await this.prisma.hackathonTeamMember.findFirst({
      where: { userId, team: { hackathonId } },
      select: { teamId: true },
    });
    if (already) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '이 해커톤에서는 이미 다른 팀에 속해 있습니다.',
      });
    }
  }

  async joinTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.prisma.hackathonTeam.findUnique({
      where: { id: teamId },
      select: { hackathonId: true },
    });
    if (!team) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '팀을 찾을 수 없습니다.',
      });
    }
    await this.assertNotInAnyTeam(team.hackathonId, userId);
    await this.prisma.hackathonTeamMember.create({ data: { teamId, userId } });
  }

  /** 마지막 팀원이 나가면 팀도 사라진다 */
  async leaveTeam(teamId: string, userId: string): Promise<void> {
    await this.prisma.hackathonTeamMember
      .delete({ where: { teamId_userId: { teamId, userId } } })
      .catch(() => undefined);
    const left = await this.prisma.hackathonTeamMember.count({ where: { teamId } });
    if (left === 0) {
      await this.prisma.hackathonTeam.delete({ where: { id: teamId } }).catch(() => undefined);
    }
  }

  private async assertTeamMember(teamId: string, userId: string, isAdmin: boolean): Promise<void> {
    if (isAdmin) return;
    const member = await this.prisma.hackathonTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '해당 팀의 팀원만 할 수 있습니다.',
      });
    }
  }

  async submit(
    teamId: string,
    userId: string,
    isAdmin: boolean,
    data: { repoUrl?: string; demoUrl?: string; idea?: string },
  ) {
    await this.assertTeamMember(teamId, userId, isAdmin);
    return this.prisma.hackathonTeam.update({
      where: { id: teamId },
      data: {
        repoUrl: data.repoUrl || null,
        demoUrl: data.demoUrl || null,
        ...(data.idea !== undefined ? { idea: data.idea } : {}),
        submittedAt: new Date(),
      },
    });
  }

  /** 심사 — 관리자만 */
  score(teamId: string, score: number, rank?: number) {
    return this.prisma.hackathonTeam.update({
      where: { id: teamId },
      data: { score, rank: rank ?? null },
    });
  }
}
