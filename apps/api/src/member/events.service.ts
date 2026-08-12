import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type EventRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

/** #4 동아리 행사 — 일정(ClubEvent) 중 신청을 받는 것들 */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, scope: 'upcoming' | 'all' = 'upcoming'): Promise<EventRow[]> {
    const events = await this.prisma.clubEvent.findMany({
      where: scope === 'upcoming' ? { startsAt: { gte: new Date(Date.now() - 86_400_000) } } : {},
      orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 100,
      include: { signups: { select: { userId: true } } },
    });
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      allDay: e.allDay,
      kind: e.kind,
      signupOpen: e.signupOpen,
      capacity: e.capacity,
      signupCount: e.signups.length,
      signedUpByMe: e.signups.some((s) => s.userId === userId),
    }));
  }

  async signup(eventId: string, userId: string, note?: string): Promise<void> {
    const event = await this.prisma.clubEvent.findUnique({
      where: { id: eventId },
      include: { _count: { select: { signups: true } } },
    });
    if (!event) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '행사를 찾을 수 없습니다.',
      });
    }
    if (!event.signupOpen) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '신청을 받고 있지 않은 행사입니다.',
      });
    }
    if (event.capacity !== null && event._count.signups >= event.capacity) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '정원이 가득 찼습니다.',
      });
    }
    await this.prisma.eventSignup.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { note: note ?? null },
      create: { eventId, userId, note: note ?? null },
    });
  }

  async cancel(eventId: string, userId: string): Promise<void> {
    await this.prisma.eventSignup
      .delete({ where: { eventId_userId: { eventId, userId } } })
      .catch(() => undefined);
  }

  async signups(eventId: string): Promise<Array<{ id: string; name: string; note: string | null }>> {
    const rows = await this.prisma.eventSignup.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ id: r.user.id, name: r.user.name, note: r.note }));
  }

  /** 관리자 — 신청 받기 토글 · 정원 설정 */
  setSignup(eventId: string, signupOpen: boolean, capacity?: number | null) {
    return this.prisma.clubEvent.update({
      where: { id: eventId },
      data: { signupOpen, capacity: capacity ?? null },
    });
  }
}
