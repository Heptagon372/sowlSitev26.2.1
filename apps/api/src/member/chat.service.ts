import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ChatMessageRow, ChatRoomRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ROOMS = [
  { slug: 'general', name: '전체', description: '아무 이야기나' },
  { slug: 'dev', name: '개발', description: '막히는 것·아는 것' },
  { slug: 'random', name: '잡담', description: '밤샘 중계' },
];

/** #20 채팅 — 메시지는 DB에 남기고, 실시간 배달은 ChatGateway가 맡는다 */
@Injectable()
export class ChatService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** 첫 기동 시 기본 방을 만들어 둔다 (없을 때만) */
  async onModuleInit(): Promise<void> {
    for (const room of DEFAULT_ROOMS) {
      await this.prisma.chatRoom
        .upsert({ where: { slug: room.slug }, update: {}, create: room })
        .catch(() => undefined);
    }
  }

  async rooms(): Promise<ChatRoomRow[]> {
    const rooms = await this.prisma.chatRoom.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });
    return rooms.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      messageCount: r._count.messages,
      lastAt: r.messages[0]?.createdAt.toISOString() ?? null,
    }));
  }

  /** 최근 메시지 (오래된 것 → 최신 순으로 돌려준다) */
  async history(slug: string, take = 60): Promise<ChatMessageRow[]> {
    const room = await this.prisma.chatRoom.findUnique({ where: { slug } });
    if (!room) return [];
    const rows = await this.prisma.chatMessage.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: { user: { select: { id: true, name: true } } },
    });
    return rows.reverse().map((m) => this.toRow(m));
  }

  async post(slug: string, userId: string, body: string): Promise<ChatMessageRow | null> {
    const text = body.trim().slice(0, 2000);
    if (!text) return null;
    const room = await this.prisma.chatRoom.findUnique({ where: { slug } });
    if (!room) return null;
    const saved = await this.prisma.chatMessage.create({
      data: { roomId: room.id, userId, body: text },
      include: { user: { select: { id: true, name: true } } },
    });
    return this.toRow(saved);
  }

  private toRow(m: {
    id: string;
    roomId: string;
    body: string;
    createdAt: Date;
    user: { id: string; name: string };
  }): ChatMessageRow {
    return {
      id: m.id,
      roomId: m.roomId,
      userId: m.user.id,
      userName: m.user.name,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    };
  }

  createRoom(data: { slug: string; name: string; description?: string }) {
    return this.prisma.chatRoom.create({
      data: {
        slug: data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: data.name,
        description: data.description ?? null,
      },
    });
  }

  removeRoom(id: string) {
    return this.prisma.chatRoom.delete({ where: { id } });
  }
}
