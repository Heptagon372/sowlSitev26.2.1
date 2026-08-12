import { Injectable, NotFoundException } from '@nestjs/common';
import type { MissionSubmission } from '@prisma/client';
import {
  ERROR_CODES,
  type MissionDetail,
  type MissionRow,
  type SubmissionRow,
} from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from './points.service';

function toSubmission(
  s: MissionSubmission & { user: { id: string; name: string } },
): SubmissionRow {
  return {
    id: s.id,
    userId: s.user.id,
    userName: s.user.name,
    content: s.content,
    link: s.link,
    submittedAt: s.submittedAt.toISOString(),
    feedback: s.feedback,
    score: s.score,
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  async list(userId: string): Promise<MissionRow[]> {
    const missions = await this.prisma.mission.findMany({
      orderBy: { dueAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { submissions: true } },
        submissions: { where: { userId }, select: { score: true } },
      },
    });
    return missions.map((m) => ({
      id: m.id,
      title: m.title,
      dueAt: m.dueAt.toISOString(),
      points: m.points,
      submissionCount: m._count.submissions,
      mySubmitted: m.submissions.length > 0,
      myScore: m.submissions[0]?.score ?? null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async detail(id: string, userId: string, isAdmin: boolean): Promise<MissionDetail> {
    const m = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        _count: { select: { submissions: true } },
        submissions: {
          orderBy: { submittedAt: 'asc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!m) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '과제를 찾을 수 없습니다.',
      });
    }
    const mine = m.submissions.find((s) => s.userId === userId) ?? null;
    return {
      id: m.id,
      title: m.title,
      body: m.body,
      dueAt: m.dueAt.toISOString(),
      points: m.points,
      submissionCount: m._count.submissions,
      mySubmitted: !!mine,
      myScore: mine?.score ?? null,
      createdAt: m.createdAt.toISOString(),
      mySubmission: mine ? toSubmission(mine) : null,
      // 다른 부원의 제출물은 관리자에게만 보인다
      submissions: isAdmin ? m.submissions.map(toSubmission) : [],
    };
  }

  create(createdBy: string, data: { title: string; body: string; dueAt: string; points?: number }) {
    return this.prisma.mission.create({
      data: {
        title: data.title,
        body: data.body,
        dueAt: new Date(data.dueAt),
        points: data.points ?? 10,
        createdBy,
      },
    });
  }

  /** 제출·재제출 — 마감 후에도 받되 화면에서 '지각'으로 표시한다 */
  async submit(missionId: string, userId: string, content: string, link?: string) {
    return this.prisma.missionSubmission.upsert({
      where: { missionId_userId: { missionId, userId } },
      update: { content, link: link ?? null, submittedAt: new Date() },
      create: { missionId, userId, content, link: link ?? null },
    });
  }

  /** 채점 — 점수를 포인트로 지급하고, 재채점 시 차액만 정정한다 */
  async review(
    submissionId: string,
    reviewerId: string,
    score: number,
    feedback?: string,
  ): Promise<void> {
    const sub = await this.prisma.missionSubmission.findUnique({
      where: { id: submissionId },
      include: { mission: { select: { title: true, points: true } } },
    });
    if (!sub) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '제출물을 찾을 수 없습니다.',
      });
    }
    const capped = Math.max(0, Math.min(score, sub.mission.points));
    await this.prisma.missionSubmission.update({
      where: { id: submissionId },
      data: {
        score: capped,
        feedback: feedback ?? null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
    await this.points.replace(
      sub.userId,
      capped,
      'MISSION_SCORE',
      `과제 채점 — ${sub.mission.title}`,
      sub.missionId,
    );
  }

  remove(id: string) {
    return this.prisma.mission.delete({ where: { id } });
  }
}
