import type { ChatMessageRow, ChatRoomRow } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

/** #20 채팅 — WebSocket 실시간, 끊기면 REST로 폴백 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('chat');
  if (!ctx) return;
  const { me, content } = ctx;

  let rooms: ChatRoomRow[] = [];
  let current = new URLSearchParams(location.search).get('room') ?? '';
  let socket: WebSocket | null = null;
  let live = false;

  content.innerHTML = `
    <div class="chatshell">
      <aside class="chatrooms">
        <div class="mpanel__t">// 채팅방</div>
        <div id="roomList"></div>
      </aside>
      <div class="chatmain mpanel" style="margin:0">
        <div class="mpanel__t">
          <span id="roomName">채팅</span>
          <span class="sp"></span>
          <span class="chatstate" id="chatState">연결 중…</span>
        </div>
        <div class="chatlog" id="chatLog"></div>
        <div class="chatpresence" id="presence"></div>
        <form class="chatform" id="chatForm">
          <input class="mctl" id="chatBody" placeholder="메시지를 입력하세요" maxlength="2000" autocomplete="off" required />
          <button class="mbtn mbtn--cy" type="submit">보내기</button>
        </form>
      </div>
    </div>`;

  const log = document.getElementById('chatLog')!;
  const stateEl = document.getElementById('chatState')!;

  function setState(text: string, on: boolean): void {
    live = on;
    stateEl.textContent = text;
    stateEl.classList.toggle('on', on);
  }

  function renderRooms(): void {
    document.getElementById('roomList')!.innerHTML = rooms
      .map(
        (r) => `
      <button class="chatroom${r.slug === current ? ' on' : ''}" data-room="${esc(r.slug)}">
        <b># ${esc(r.name)}</b>
        <span class="dim">${r.messageCount}개</span>
      </button>`,
      )
      .join('');

    document.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((b) =>
      b.addEventListener('click', () => {
        current = b.dataset.room!;
        const url = new URL(location.href);
        url.searchParams.set('room', current);
        history.replaceState(null, '', url);
        renderRooms();
        void join();
      }),
    );

    const room = rooms.find((r) => r.slug === current);
    document.getElementById('roomName')!.textContent = room ? `# ${room.name}` : '채팅';
  }

  function line(m: ChatMessageRow): string {
    const mine = m.userId === me.id;
    return `
    <div class="chatmsg${mine ? ' mine' : ''}">
      <div class="chatmsg__head"><b>${esc(m.userName)}</b><span class="dim">${fmtDateTime(m.createdAt)}</span></div>
      <div class="chatmsg__body">${esc(m.body)}</div>
    </div>`;
  }

  function renderLog(messages: ChatMessageRow[]): void {
    log.innerHTML = messages.length
      ? messages.map(line).join('')
      : '<p class="mtop__desc" style="text-align:center;padding:30px 0">첫 메시지를 남겨보세요.</p>';
    log.scrollTop = log.scrollHeight;
  }

  function append(m: ChatMessageRow): void {
    const empty = log.querySelector('.mtop__desc');
    if (empty) log.innerHTML = '';
    log.insertAdjacentHTML('beforeend', line(m));
    log.scrollTop = log.scrollHeight;
  }

  /** 방 입장 — 소켓이 살아 있으면 join, 아니면 REST로 기록만 불러온다 */
  async function join(): Promise<void> {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'join', room: current }));
      return;
    }
    try {
      renderLog(await api.member.chat.history(current));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : '대화를 불러오지 못했습니다.');
    }
  }

  function connect(): void {
    try {
      socket = new WebSocket(api.member.chat.socketUrl());
    } catch {
      setState('실시간 연결 불가 (새로고침으로 갱신)', false);
      return;
    }

    socket.addEventListener('open', () => {
      setState('● 실시간 연결됨', true);
      socket!.send(JSON.stringify({ type: 'join', room: current }));
    });

    socket.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data as string) as {
        type: string;
        message?: ChatMessageRow;
        messages?: ChatMessageRow[];
        users?: string[];
        room?: string;
      };
      if (msg.type === 'history' && msg.messages) renderLog(msg.messages);
      else if (msg.type === 'message' && msg.message) append(msg.message);
      else if (msg.type === 'presence' && msg.users) {
        document.getElementById('presence')!.textContent = msg.users.length
          ? `접속 중: ${msg.users.join(', ')}`
          : '';
      } else if (msg.type === 'error') {
        setState('연결 거부됨', false);
      }
    });

    socket.addEventListener('close', () => {
      setState('연결 끊김 — 전송은 계속됩니다', false);
      socket = null;
    });
    socket.addEventListener('error', () => setState('실시간 연결 실패 (전송은 가능)', false));
  }

  document.getElementById('chatForm')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatBody') as HTMLInputElement;
    const body = input.value.trim();
    if (!body || !current) return;
    input.value = '';

    if (live && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'message', body }));
      return;
    }
    // 폴백 — 소켓이 없으면 REST로 보내고 화면에 직접 붙인다
    void api.member.chat
      .post(current, body)
      .then((m) => {
        if (m) append(m);
      })
      .catch((err: unknown) => toast(err instanceof ApiError ? err.message : '전송에 실패했습니다.'));
  });

  try {
    rooms = await api.member.chat.rooms();
  } catch (e) {
    toast(e instanceof ApiError ? e.message : '채팅방을 불러오지 못했습니다.');
  }
  if (!current) current = rooms[0]?.slug ?? 'general';
  renderRooms();
  await join();
  connect();
}

void main();
