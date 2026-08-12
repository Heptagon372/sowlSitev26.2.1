import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, type AttendanceStat, type SeminarRow } from '@sowl/shared';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from './points.service';

const CODE_MINUTES = 15;

@Injectable()
export class SeminarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  private codeOpen(s: { codeEndsAt: Date | null }): boolean {
    return !!s.codeEndsAt && s.codeEndsAt > new Date();
  }

  async list(userId: string, isAdmin: boolean): Promise<SeminarRow[]> {
    const seminars = await this.prisma.seminar.findMany({
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: {
        speaker: { select: { id: true, name: true } },
        attendances: { select: { userId: true } },
      },
    });
    return seminars.map((s) => {
      const open = this.codeOpen(s);
      // 코드 값은 발표자·관리자에게만 (부원은 열렸는지 여부만 본다)
      const canSeeCode = isAdmin || s.speakerId === userId;
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        speakerId: s.speakerId,
        speakerName: s.speaker?.name ?? null,
        startsAt: s.startsAt.toISOString(),
        location: s.location,
        slideUrl: s.slideUrl,
        points: s.points,
        attendeeCount: s.attendances.length,
        attendedByMe: s.attendances.some((a) => a.userId === userId),
        codeOpen: open,
        attendCode: open && canSeeCode ? s.attendCode : null,
      };
    });
  }

  create(data: {
    title: string;
    description?: string;
    startsAt: string;
    location?: string;
    slideUrl?: string;
    points?: number;
    speakerId?: string;
  }) {
    return this.prisma.seminar.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        startsAt: new Date(data.startsAt),
        location: data.location ?? null,
        slideUrl: data.slideUrl ?? null,
        points: data.points ?? 5,
        speakerId: data.speakerId ?? null,
      },
    });
  }

  /** 발표자 신청 — 비어 있을 때만 가능, 본인이 발표자면 취소 */
  async claimSpeaker(id: string, userId: string): Promise<{ speakerId: string | null }> {
    const s = await this.prisma.seminar.findUnique({
      where: { id },
      select: { speakerId: true },
    });
    if (!s) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '세미나를 찾을 수 없습니다.',
      });
    }
    if (s.speakerId && s.speakerId !== userId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '이미 다른 부원이 발표를 맡았습니다.',
      });
    }
    const next = s.speakerId === userId ? null : userId;
    await this.prisma.seminar.update({ where: { id }, data: { speakerId: next } });
    return { speakerId: next };
  }

  async setSlide(id: string, userId: string, isAdmin: boolean, slideUrl: string) {
    const s = await this.prisma.seminar.findUniqueOrThrow({
      where: { id },
      select: { speakerId: true },
    });
    if (s.speakerId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '발표자만 슬라이드를 등록할 수 있습니다.',
      });
    }
    return this.prisma.seminar.update({ where: { id }, data: { slideUrl: slideUrl || null } });
  }

  /** 출석 코드 열기 — 6자리 숫자, 15분간 유효. 발표자·관리자만. */
  async openCode(id: string, userId: string, isAdmin: boolean): Promise<{ code: string; endsAt: string }> {
    const s = await this.prisma.seminar.findUniqueOrThrow({
      where: { id },
      select: { speakerId: true },
    });
    if (s.speakerId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '발표자 또는 관리자만 출석을 열 수 있습니다.',
      });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const endsAt = new Date(Date.now() + CODE_MINUTES * 60_000);
    await this.prisma.seminar.update({
      where: { id },
      data: { attendCode: code, codeOpenAt: new Date(), codeEndsAt: endsAt },
    });
    return { code, endsAt: endsAt.toISOString() };
  }

  async closeCode(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const s = await this.prisma.seminar.findUniqueOrThrow({
      where: { id },
      select: { speakerId: true },
    });
    if (s.speakerId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '발표자 또는 관리자만 출석을 닫을 수 있습니다.',
      });
    }
    await this.prisma.seminar.update({
      where: { id },
      data: { attendCode: null, codeEndsAt: null },
    });
  }

  /** 코드 입력 출석 — 성공 시 세미나 포인트 지급 (중복 지급 없음) */
  async checkIn(code: string, userId: string): Promise<{ seminarTitle: string; points: number }> {
    const seminar = await this.prisma.seminar.findFirst({
      where: { attendCode: code.trim(), codeEndsAt: { gt: new Date() } },
    });
    if (!seminar) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '유효하지 않거나 만료된 출석 코드입니다.',
      });
    }
    const already = await this.prisma.seminarAttendance.findUnique({
      where: { seminarId_userId: { seminarId: seminar.id, userId } },
    });
    if (already) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '이미 출석 처리된 세미나입니다.',
      });
    }
    await this.prisma.seminarAttendance.create({
      data: { seminarId: seminar.id, userId },
    });
    await this.points.award(
      userId,
      seminar.points,
      'SEMINAR_ATTEND',
      `세미나 출석 — ${seminar.title}`,
      seminar.id,
    );
    return { seminarTitle: seminar.title, points: seminar.points };
  }

  /** 개인 출석률 — 이미 지난 세미나만 분모로 센다 */
  async myStats(userId: string): Promise<AttendanceStat> {
    const past = await this.prisma.seminar.findMany({
      where: { startsAt: { lte: new Date() } },
      orderBy: { startsAt: 'desc' },
      include: { attendances: { where: { userId }, select: { userId: true } } },
    });
    const attended = past.filter((s) => s.attendances.length > 0).length;
    return {
      totalSeminars: past.length,
      attended,
      rate: past.length ? Math.round((attended / past.length) * 100) : 0,
      recent: past.slice(0, 12).map((s) => ({
        seminarId: s.id,
        title: s.title,
        startsAt: s.startsAt.toISOString(),
        attended: s.attendances.length > 0,
      })),
    };
  }

  /** 세미나별 출석자 (발표자·관리자용) */
  async attendees(id: string): Promise<Array<{ id: string; name: string; checkedAt: string }>> {
    const rows = await this.prisma.seminarAttendance.findMany({
      where: { seminarId: id },
      orderBy: { checkedAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      checkedAt: r.checkedAt.toISOString(),
    }));
  }

  remove(id: string) {
    return this.prisma.seminar.delete({ where: { id } });
  }
}
