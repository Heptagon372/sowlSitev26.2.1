import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { ACCESS_COOKIE, TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

interface Client extends WebSocket {
  userId?: string;
  userName?: string;
  room?: string;
}

/** 쿠키 헤더에서 하나만 뽑아낸다 (게이트웨이에는 cookie-parser가 걸리지 않는다) */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * 회원 전용 실시간 채팅 (ws).
 * 핸드셰이크의 access 쿠키로 인증하고, GUEST·비로그인은 즉시 끊는다 —
 * REST와 같은 규칙을 소켓에도 적용해야 프론트 가드만 믿는 상황이 안 생긴다.
 */
@WebSocketGateway({ path: '/api/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('ChatGateway');
  private readonly clients = new Set<Client>();

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(client: Client, req: IncomingMessage): Promise<void> {
    const token = readCookie(req.headers.cookie, ACCESS_COOKIE);
    const payload = token ? this.tokens.verifyAccess(token) : null;
    const user = payload
      ? await this.prisma.user.findUnique({ where: { id: payload.sub } })
      : null;

    if (!user || user.role === 'GUEST') {
      client.send(JSON.stringify({ type: 'error', message: '회원만 이용할 수 있습니다.' }));
      client.close(4403, 'MEMBER_ONLY');
      return;
    }

    client.userId = user.id;
    client.userName = user.name;
    client.room = 'general';
    this.clients.add(client);
    client.send(JSON.stringify({ type: 'ready', userId: user.id, name: user.name }));
    this.broadcastPresence(client.room);

    client.on('message', (raw: Buffer | string) => {
      void this.onMessage(client, raw.toString());
    });
  }

  handleDisconnect(client: Client): void {
    const room = client.room;
    this.clients.delete(client);
    if (room) this.broadcastPresence(room);
  }

  private async onMessage(client: Client, raw: string): Promise<void> {
    if (!client.userId) return;
    let msg: { type?: string; room?: string; body?: string };
    try {
      msg = JSON.parse(raw) as typeof msg;
    } catch {
      return;
    }

    if (msg.type === 'join' && msg.room) {
      const previous = client.room;
      client.room = msg.room;
      const history = await this.chat.history(msg.room);
      client.send(JSON.stringify({ type: 'history', room: msg.room, messages: history }));
      if (previous) this.broadcastPresence(previous);
      this.broadcastPresence(msg.room);
      return;
    }

    if (msg.type === 'message' && msg.body && client.room) {
      const saved = await this.chat.post(client.room, client.userId, msg.body);
      if (saved) this.broadcast(client.room, { type: 'message', message: saved });
      return;
    }

    if (msg.type === 'ping') {
      client.send(JSON.stringify({ type: 'pong' }));
    }
  }

  private broadcast(room: string, payload: unknown): void {
    const data = JSON.stringify(payload);
    for (const c of this.clients) {
      if (c.room === room && c.readyState === 1) c.send(data);
    }
  }

  /** 같은 방에 접속 중인 사람 목록 */
  private broadcastPresence(room: string): void {
    const names = [...this.clients]
      .filter((c) => c.room === room && c.userName)
      .map((c) => c.userName!);
    this.broadcast(room, { type: 'presence', room, users: [...new Set(names)] });
  }
}
