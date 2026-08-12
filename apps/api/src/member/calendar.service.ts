import { Injectable } from '@nestjs/common';
import type { ClubEvent } from '@prisma/client';
import type { EventRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

type EventWithSignups = ClubEvent & { signups?: Array<{ userId: string }> };

/** 신청 정보는 행사 페이지(§4)에서 쓰고, 캘린더에서는 표시만 한다 */
function toRow(e: EventWithSignups, userId?: string): EventRow {
  const signups = e.signups ?? [];
  return {
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
    signupCount: signups.length,
    signedUpByMe: !!userId && signups.some((s) => s.userId === userId),
  };
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /** month = 'YYYY-MM' — 그 달에 걸치는 일정 전부 */
  async month(month: string, userId?: string): Promise<EventRow[]> {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    const now = new Date();
    const y = m ? Number(m[1]) : now.getFullYear();
    const mo = m ? Number(m[2]) - 1 : now.getMonth();
    const from = new Date(y, mo, 1);
    const to = new Date(y, mo + 1, 1);
    const events = await this.prisma.clubEvent.findMany({
      where: { startsAt: { lt: to }, OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }] },
      orderBy: { startsAt: 'asc' },
      include: { signups: { select: { userId: true } } },
    });
    return events.map((e) => toRow(e, userId));
  }

  async upcoming(take = 5, userId?: string): Promise<EventRow[]> {
    const events = await this.prisma.clubEvent.findMany({
      where: { startsAt: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { startsAt: 'asc' },
      take,
      include: { signups: { select: { userId: true } } },
    });
    return events.map((e) => toRow(e, userId));
  }

  create(data: {
    title: string;
    description?: string | null;
    location?: string | null;
    startsAt: string;
    endsAt?: string | null;
    allDay?: boolean;
    kind?: string | null;
    createdBy?: string;
  }) {
    return this.prisma.clubEvent.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        allDay: data.allDay ?? false,
        kind: data.kind ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  remove(id: string) {
    return this.prisma.clubEvent.delete({ where: { id } });
  }

  /** iCal 내보내기 — 캘린더 앱 구독용 */
  async ical(): Promise<string> {
    const events = await this.prisma.clubEvent.findMany({ orderBy: { startsAt: 'asc' } });
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//S.OWL//Club Calendar//KO',
      'X-WR-CALNAME:S.OWL 동아리 일정',
    ];
    for (const e of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}@sowl`,
        `DTSTAMP:${fmt(e.createdAt)}`,
        `DTSTART:${fmt(e.startsAt)}`,
        `DTEND:${fmt(e.endsAt ?? new Date(e.startsAt.getTime() + 3_600_000))}`,
        `SUMMARY:${esc(e.title)}`,
        ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
        ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}
