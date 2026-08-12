import { Injectable } from '@nestjs/common';
import type {
  ActivityItem,
  MyActivity,
  ProjectStatus,
  StudyStatus,
} from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SeminarsService } from './seminars.service';

/**
 * 활동 기록 — 별도 이벤트 테이블을 두지 않고 기존 테이블을 모아서 만든다.
 * 어딘가에서 기록을 빠뜨려 타임라인이 비는 일이 없도록 하기 위해서다.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seminars: SeminarsService,
  ) {}

  async timeline(take = 60, kinds?: string[]): Promise<ActivityItem[]> {
    const want = (k: string) => !kinds?.length || kinds.includes(k);
    const limit = Math.min(take, 100);

    const [notices, seminars, missions, studies, projects, posts, questions, polls, files, events] =
      await Promise.all([
        want('NOTICE')
          ? this.prisma.notice.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { author: { select: { name: true } } },
            })
          : [],
        want('SEMINAR')
          ? this.prisma.seminar.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { speaker: { select: { name: true } }, _count: { select: { attendances: true } } },
            })
          : [],
        want('MISSION')
          ? this.prisma.mission.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
          : [],
        want('STUDY')
          ? this.prisma.study.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { leader: { select: { name: true } }, _count: { select: { members: true } } },
            })
          : [],
        want('PROJECT')
          ? this.prisma.project.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { owner: { select: { name: true } } },
            })
          : [],
        want('POST')
          ? this.prisma.post.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { author: { select: { name: true } } },
            })
          : [],
        want('QUESTION')
          ? this.prisma.question.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { author: { select: { name: true } } },
            })
          : [],
        want('POLL')
          ? this.prisma.poll.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { author: { select: { name: true } } },
            })
          : [],
        want('FILE')
          ? this.prisma.sharedFile.findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: { uploader: { select: { name: true } } },
            })
          : [],
        want('EVENT')
          ? this.prisma.clubEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
          : [],
      ]);

    const items: ActivityItem[] = [
      ...notices.map((n) => ({
        kind: 'NOTICE' as const,
        title: n.title,
        who: n.author.name,
        at: n.createdAt.toISOString(),
        href: `/member/notice/notices.html#${n.id}`,
        detail: n.pinned ? '고정 공지' : null,
      })),
      ...seminars.map((s) => ({
        kind: 'SEMINAR' as const,
        title: s.title,
        who: s.speaker?.name ?? null,
        at: s.createdAt.toISOString(),
        href: '/member/study/seminars.html',
        detail: `출석 ${s._count.attendances}명`,
      })),
      ...missions.map((m) => ({
        kind: 'MISSION' as const,
        title: m.title,
        who: null,
        at: m.createdAt.toISOString(),
        href: '/member/study/missions.html',
        detail: `마감 ${m.dueAt.toISOString().slice(0, 10)}`,
      })),
      ...studies.map((s) => ({
        kind: 'STUDY' as const,
        title: s.title,
        who: s.leader.name,
        at: s.createdAt.toISOString(),
        href: '/member/study/studies.html',
        detail: `${s._count.members}명 참여`,
      })),
      ...projects.map((p) => ({
        kind: 'PROJECT' as const,
        title: p.name,
        who: p.owner.name,
        at: p.createdAt.toISOString(),
        href: '/member/project/projects.html',
        detail: p.summary,
      })),
      ...posts.map((p) => ({
        kind: 'POST' as const,
        title: p.title,
        who: p.author.name,
        at: p.createdAt.toISOString(),
        href: `/member/community/board.html#${p.id}`,
        detail: null,
      })),
      ...questions.map((q) => ({
        kind: 'QUESTION' as const,
        title: q.title,
        who: q.author.name,
        at: q.createdAt.toISOString(),
        href: `/member/community/qna.html#${q.id}`,
        detail: q.acceptedAnswerId ? '해결됨' : null,
      })),
      ...polls.map((p) => ({
        kind: 'POLL' as const,
        title: p.title,
        who: p.author.name,
        at: p.createdAt.toISOString(),
        href: '/member/community/polls.html',
        detail: null,
      })),
      ...files.map((f) => ({
        kind: 'FILE' as const,
        title: f.name,
        who: f.uploader.name,
        at: f.createdAt.toISOString(),
        href: f.studyId ? '/member/study/study-files.html' : '/member/study/files.html',
        detail: f.category,
      })),
      ...events.map((e) => ({
        kind: 'EVENT' as const,
        title: e.title,
        who: null,
        at: e.createdAt.toISOString(),
        href: '/member/notice/calendar.html',
        detail: e.location,
      })),
    ];

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  async mine(userId: string): Promise<MyActivity> {
    const [
      studies,
      attendance,
      submissions,
      projects,
      posts,
      comments,
      questions,
      answers,
      files,
      user,
      points,
    ] = await Promise.all([
      this.prisma.studyMember.findMany({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        include: { study: { select: { id: true, title: true, status: true } } },
      }),
      this.seminars.myStats(userId),
      this.prisma.missionSubmission.findMany({
        where: { userId },
        orderBy: { submittedAt: 'desc' },
        include: { mission: { select: { id: true, title: true } } },
      }),
      this.prisma.projectMember.findMany({
        where: { userId },
        include: { project: { select: { id: true, name: true, status: true } } },
      }),
      this.prisma.post.count({ where: { authorId: userId } }),
      this.prisma.comment.count({ where: { authorId: userId } }),
      this.prisma.question.count({ where: { authorId: userId } }),
      this.prisma.answer.count({ where: { authorId: userId } }),
      this.prisma.sharedFile.count({ where: { uploaderId: userId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } }),
      this.prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // 내 타임라인 — 내가 남긴 것만 모은다
    const [myPosts, myQuestions, myFiles] = await Promise.all([
      this.prisma.post.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.question.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.sharedFile.findMany({
        where: { uploaderId: userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const timeline: ActivityItem[] = [
      ...myPosts.map((p) => ({
        kind: 'POST' as const,
        title: p.title,
        who: null,
        at: p.createdAt.toISOString(),
        href: `/member/community/board.html#${p.id}`,
        detail: '글 작성',
      })),
      ...myQuestions.map((q) => ({
        kind: 'QUESTION' as const,
        title: q.title,
        who: null,
        at: q.createdAt.toISOString(),
        href: `/member/community/qna.html#${q.id}`,
        detail: '질문',
      })),
      ...myFiles.map((f) => ({
        kind: 'FILE' as const,
        title: f.name,
        who: null,
        at: f.createdAt.toISOString(),
        href: '/member/study/files.html',
        detail: '자료 업로드',
      })),
      ...submissions.map((s) => ({
        kind: 'MISSION' as const,
        title: s.mission.title,
        who: null,
        at: s.submittedAt.toISOString(),
        href: '/member/study/missions.html',
        detail: s.score !== null ? `${s.score}점` : '채점 대기',
      })),
      ...points.map((p) => ({
        kind: 'SEMINAR' as const,
        title: p.reason,
        who: null,
        at: p.createdAt.toISOString(),
        href: '/member/record/points.html',
        detail: `${p.delta > 0 ? '+' : ''}${p.delta}pt`,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 40);

    return {
      joinedStudies: studies.map((s) => ({
        id: s.study.id,
        title: s.study.title,
        status: s.study.status as StudyStatus,
        joinedAt: s.joinedAt.toISOString(),
      })),
      attendance,
      submissions: submissions.map((s) => ({
        missionId: s.mission.id,
        title: s.mission.title,
        submittedAt: s.submittedAt.toISOString(),
        score: s.score,
        feedback: s.feedback,
      })),
      projects: projects.map((p) => ({
        id: p.project.id,
        name: p.project.name,
        role: p.role,
        status: p.project.status as ProjectStatus,
      })),
      counts: { posts, comments, questions, answers, files },
      points: user.points,
      timeline,
    };
  }
}
