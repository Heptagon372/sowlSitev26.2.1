import type {
  AccessLogRow,
  ActivityItem,
  AiAnswer,
  AdminApplicationDetail,
  AdminDashboard,
  AdminListResult,
  AdminUserRow,
  ApiErrorBody,
  ApplicationInput,
  ApplicationResult,
  AttendanceStat,
  AuditLogRow,
  CertificateData,
  ChatMessageRow,
  ChatRoomRow,
  ClubGithubRow,
  ClubStats,
  CommentRow,
  CommunityHub,
  ContestFeedRow,
  ContestRow,
  DuesPage,
  EventRow,
  FileRow,
  GithubActivity,
  HackathonRow,
  HackathonStatus,
  KanbanBoard,
  LoginInput,
  MemberDashboard,
  MemberRow,
  MissionDetail,
  MissionRow,
  MyActivity,
  NoticeDetail,
  NoticeRow,
  PointsPage,
  PollRow,
  PortfolioItem,
  PostDetail,
  PostRow,
  ProfileUpdateInput,
  ProjectRow,
  ProjectStatus,
  QuestionDetail,
  QuestionRow,
  RackDeviceRow,
  RecruitInfo,
  Role,
  SeminarRow,
  SessionUser,
  SignupInput,
  SiteSettings,
  StudyDetail,
  StudyRow,
  StudyStatus,
  TeamPostRow,
  WhitelistRow,
} from '@sowl/shared';
import { SITE } from '../config';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // JWT는 httpOnly 쿠키로 오간다 — 모든 요청에 credentials 포함
    res = await fetch(`${SITE.apiBase}${path}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결할 수 없습니다.');
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* JSON이 아니면 무시 */
    }
    throw new ApiError(
      body.statusCode ?? res.status,
      body.code ?? 'INTERNAL',
      body.message ?? '서버 오류가 발생했습니다.',
    );
  }
  return (await res.json()) as T;
}

let refreshing: Promise<void> | null = null;

/** access 토큰(30분)이 만료됐으면 refresh 쿠키로 한 번 갱신 후 재시도 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (err) {
    const is401 =
      err instanceof ApiError && err.statusCode === 401 && !path.startsWith('/auth/');
    if (!is401) throw err;
    refreshing ??= rawRequest<SessionUser>('/auth/refresh', { method: 'POST' })
      .then(() => undefined)
      .finally(() => {
        refreshing = null;
      });
    await refreshing; // 갱신 실패면 여기서 throw → 원래 401 흐름
    return rawRequest<T>(path, init);
  }
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/* 페이지 내 중복 호출 방지용 캐시 */
let recruitPromise: Promise<RecruitInfo> | null = null;
let statsPromise: Promise<ClubStats> | null = null;
let mePromise: Promise<SessionUser | null> | null = null;

export const api = {
  recruit(): Promise<RecruitInfo> {
    recruitPromise ??= request<RecruitInfo>('/recruit').catch((e) => {
      recruitPromise = null;
      throw e;
    });
    return recruitPromise;
  },

  stats(): Promise<ClubStats> {
    statsPromise ??= request<ClubStats>('/stats').catch((e) => {
      statsPromise = null;
      throw e;
    });
    return statsPromise;
  },

  submitApplication(payload: ApplicationInput): Promise<ApplicationResult> {
    return request<ApplicationResult>('/applications', json('POST', payload));
  },

  /* ---------- 인증 ---------- */
  auth: {
    /** 로그인 상태면 SessionUser, 아니면 null (에러를 던지지 않는다) */
    me(): Promise<SessionUser | null> {
      mePromise ??= request<SessionUser>('/auth/me').catch((e) => {
        if (e instanceof ApiError && e.statusCode === 401) return null;
        mePromise = null;
        throw e;
      });
      return mePromise;
    },
    invalidateMe(): void {
      mePromise = null;
    },
    async signup(input: SignupInput): Promise<SessionUser> {
      const user = await request<SessionUser>('/auth/signup', json('POST', input));
      mePromise = Promise.resolve(user);
      return user;
    },
    async login(input: LoginInput): Promise<SessionUser> {
      const user = await request<SessionUser>('/auth/login', json('POST', input));
      mePromise = Promise.resolve(user);
      return user;
    },
    async logout(): Promise<void> {
      await request('/auth/logout', { method: 'POST' });
      mePromise = Promise.resolve(null);
    },
  },

  /* ---------- 회원 전용 ---------- */
  member: {
    dashboard(): Promise<MemberDashboard> {
      return request('/member/dashboard');
    },
    notices: {
      list(): Promise<NoticeRow[]> {
        return request('/member/notices');
      },
      detail(id: string): Promise<NoticeDetail> {
        return request(`/member/notices/${id}`);
      },
      create(data: { title: string; body: string; pinned?: boolean }): Promise<unknown> {
        return request('/member/notices', json('POST', data));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/notices/${id}`, { method: 'DELETE' });
      },
    },
    calendar: {
      month(month: string): Promise<EventRow[]> {
        return request(`/member/calendar?month=${encodeURIComponent(month)}`);
      },
      icalUrl(): string {
        return `${SITE.apiBase}/member/calendar/ical`;
      },
      create(data: {
        title: string;
        description?: string;
        location?: string;
        startsAt: string;
        endsAt?: string;
        allDay?: boolean;
        kind?: string;
      }): Promise<unknown> {
        return request('/member/calendar', json('POST', data));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/calendar/${id}`, { method: 'DELETE' });
      },
    },
    members(params: { q?: string; generation?: string; department?: string } = {}): Promise<MemberRow[]> {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.generation) qs.set('generation', params.generation);
      if (params.department) qs.set('department', params.department);
      return request(`/member/members${qs.size ? `?${qs}` : ''}`);
    },
    profile: {
      async update(data: ProfileUpdateInput): Promise<SessionUser> {
        const user = await request<SessionUser>('/member/profile', json('PATCH', data));
        mePromise = Promise.resolve(user);
        return user;
      },
      password(current: string, next: string): Promise<{ ok: true }> {
        return request('/member/profile/password', json('POST', { current, next }));
      },
    },
    posts: {
      list(page = 1): Promise<{ total: number; items: PostRow[] }> {
        return request(`/member/posts?page=${page}`);
      },
      detail(id: string): Promise<PostDetail> {
        return request(`/member/posts/${id}`);
      },
      create(title: string, body: string): Promise<{ id: string }> {
        return request('/member/posts', json('POST', { title, body }));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/posts/${id}`, { method: 'DELETE' });
      },
      like(id: string): Promise<{ liked: boolean; likeCount: number }> {
        return request(`/member/posts/${id}/like`, { method: 'POST' });
      },
      comment(id: string, body: string): Promise<CommentRow> {
        return request(`/member/posts/${id}/comments`, json('POST', { body }));
      },
      removeComment(id: string): Promise<unknown> {
        return request(`/member/posts/comments/${id}`, { method: 'DELETE' });
      },
    },
    files: {
      /** studyId 를 주면 그 스터디 자료실, 없으면 공용 자료실 */
      list(params: { category?: string; q?: string; studyId?: string } = {}): Promise<FileRow[]> {
        const qs = new URLSearchParams();
        if (params.category) qs.set('category', params.category);
        if (params.q) qs.set('q', params.q);
        if (params.studyId) qs.set('studyId', params.studyId);
        return request(`/member/files${qs.size ? `?${qs}` : ''}`);
      },
      async upload(file: File, category: string, studyId?: string): Promise<FileRow> {
        const form = new FormData();
        form.append('file', file);
        form.append('category', category);
        if (studyId) form.append('studyId', studyId);
        return request('/member/files', { method: 'POST', body: form });
      },
      downloadUrl(id: string): string {
        return `${SITE.apiBase}/member/files/${id}/download`;
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/files/${id}`, { method: 'DELETE' });
      },
    },

    /* ---------- 2차 ---------- */
    studies: {
      list(params: { status?: string; q?: string } = {}): Promise<StudyRow[]> {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.q) qs.set('q', params.q);
        return request(`/member/studies${qs.size ? `?${qs}` : ''}`);
      },
      detail(id: string): Promise<StudyDetail> {
        return request(`/member/studies/${id}`);
      },
      create(data: {
        title: string;
        description: string;
        topic?: string;
        schedule?: string;
        maxMembers?: number;
      }): Promise<{ id: string }> {
        return request('/member/studies', json('POST', data));
      },
      join(id: string): Promise<unknown> {
        return request(`/member/studies/${id}/join`, { method: 'POST' });
      },
      leave(id: string): Promise<unknown> {
        return request(`/member/studies/${id}/join`, { method: 'DELETE' });
      },
      setStatus(id: string, status: StudyStatus): Promise<unknown> {
        return request(`/member/studies/${id}/status`, json('PATCH', { status }));
      },
      addWeek(id: string, data: { title: string; content?: string; meetAt?: string }): Promise<unknown> {
        return request(`/member/studies/${id}/weeks`, json('POST', data));
      },
      toggleWeek(weekId: string): Promise<unknown> {
        return request(`/member/studies/weeks/${weekId}/toggle`, { method: 'PATCH' });
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/studies/${id}`, { method: 'DELETE' });
      },
    },

    seminars: {
      list(): Promise<SeminarRow[]> {
        return request('/member/seminars');
      },
      myStats(): Promise<AttendanceStat> {
        return request('/member/seminars/attendance/me');
      },
      attendees(id: string): Promise<Array<{ id: string; name: string; checkedAt: string }>> {
        return request(`/member/seminars/${id}/attendees`);
      },
      create(data: {
        title: string;
        description?: string;
        startsAt: string;
        location?: string;
        points?: number;
      }): Promise<unknown> {
        return request('/member/seminars', json('POST', data));
      },
      claimSpeaker(id: string): Promise<{ speakerId: string | null }> {
        return request(`/member/seminars/${id}/speaker`, { method: 'POST' });
      },
      setSlide(id: string, slideUrl: string): Promise<unknown> {
        return request(`/member/seminars/${id}/slide`, json('PATCH', { slideUrl }));
      },
      openCode(id: string): Promise<{ code: string; endsAt: string }> {
        return request(`/member/seminars/${id}/code`, { method: 'POST' });
      },
      closeCode(id: string): Promise<unknown> {
        return request(`/member/seminars/${id}/code`, { method: 'DELETE' });
      },
      checkIn(code: string): Promise<{ seminarTitle: string; points: number }> {
        return request('/member/seminars/check-in', json('POST', { code }));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/seminars/${id}`, { method: 'DELETE' });
      },
    },

    missions: {
      list(): Promise<MissionRow[]> {
        return request('/member/missions');
      },
      detail(id: string): Promise<MissionDetail> {
        return request(`/member/missions/${id}`);
      },
      create(data: { title: string; body: string; dueAt: string; points?: number }): Promise<unknown> {
        return request('/member/missions', json('POST', data));
      },
      submit(id: string, content: string, link?: string): Promise<unknown> {
        return request(`/member/missions/${id}/submit`, json('POST', { content, link }));
      },
      review(submissionId: string, score: number, feedback?: string): Promise<unknown> {
        return request(
          `/member/missions/submissions/${submissionId}/review`,
          json('POST', { score, feedback }),
        );
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/missions/${id}`, { method: 'DELETE' });
      },
    },

    projects: {
      list(params: { status?: ProjectStatus | ''; q?: string } = {}): Promise<ProjectRow[]> {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.q) qs.set('q', params.q);
        return request(`/member/projects${qs.size ? `?${qs}` : ''}`);
      },
      create(data: Record<string, unknown>): Promise<unknown> {
        return request('/member/projects', json('POST', data));
      },
      update(id: string, data: Record<string, unknown>): Promise<unknown> {
        return request(`/member/projects/${id}`, json('PATCH', data));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/projects/${id}`, { method: 'DELETE' });
      },
    },

    teamPosts: {
      list(params: { status?: string; position?: string; tech?: string } = {}): Promise<TeamPostRow[]> {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.position) qs.set('position', params.position);
        if (params.tech) qs.set('tech', params.tech);
        return request(`/member/team-posts${qs.size ? `?${qs}` : ''}`);
      },
      create(data: {
        title: string;
        body: string;
        positions?: string[];
        techStack?: string[];
        projectId?: string;
      }): Promise<unknown> {
        return request('/member/team-posts', json('POST', data));
      },
      apply(id: string, message: string, position?: string): Promise<unknown> {
        return request(`/member/team-posts/${id}/apply`, json('POST', { message, position }));
      },
      decide(applicationId: string, accept: boolean): Promise<unknown> {
        return request(`/member/team-posts/applications/${applicationId}`, json('PATCH', { accept }));
      },
      toggle(id: string): Promise<unknown> {
        return request(`/member/team-posts/${id}/toggle`, { method: 'PATCH' });
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/team-posts/${id}`, { method: 'DELETE' });
      },
    },

    qna: {
      list(params: { q?: string; tag?: string; unsolved?: boolean } = {}): Promise<QuestionRow[]> {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.tag) qs.set('tag', params.tag);
        if (params.unsolved) qs.set('unsolved', 'true');
        return request(`/member/questions${qs.size ? `?${qs}` : ''}`);
      },
      detail(id: string): Promise<QuestionDetail> {
        return request(`/member/questions/${id}`);
      },
      ask(data: { title: string; body: string; tags?: string[] }): Promise<{ id: string }> {
        return request('/member/questions', json('POST', data));
      },
      answer(id: string, body: string): Promise<unknown> {
        return request(`/member/questions/${id}/answers`, json('POST', { body }));
      },
      accept(id: string, answerId: string): Promise<unknown> {
        return request(`/member/questions/${id}/accept/${answerId}`, { method: 'POST' });
      },
      removeAnswer(answerId: string): Promise<unknown> {
        return request(`/member/questions/answers/${answerId}`, { method: 'DELETE' });
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/questions/${id}`, { method: 'DELETE' });
      },
    },

    polls: {
      list(): Promise<PollRow[]> {
        return request('/member/polls');
      },
      create(data: {
        title: string;
        description?: string;
        options: string[];
        multiple?: boolean;
        anonymous?: boolean;
        closesAt?: string;
      }): Promise<unknown> {
        return request('/member/polls', json('POST', data));
      },
      vote(id: string, optionId: string): Promise<unknown> {
        return request(`/member/polls/${id}/vote/${optionId}`, { method: 'POST' });
      },
      voters(id: string): Promise<Array<{ optionLabel: string; names: string[] }>> {
        return request(`/member/polls/${id}/voters`);
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/polls/${id}`, { method: 'DELETE' });
      },
    },

    points(generation?: number): Promise<PointsPage> {
      return request(`/member/points${generation ? `?generation=${generation}` : ''}`);
    },

    /* ---------- 3차 ---------- */
    events: {
      list(scope: 'upcoming' | 'all' = 'upcoming'): Promise<EventRow[]> {
        return request(`/member/events?scope=${scope}`);
      },
      signups(id: string): Promise<Array<{ id: string; name: string; note: string | null }>> {
        return request(`/member/events/${id}/signups`);
      },
      signup(id: string, note?: string): Promise<unknown> {
        return request(`/member/events/${id}/signup`, json('POST', { note }));
      },
      cancel(id: string): Promise<unknown> {
        return request(`/member/events/${id}/signup`, { method: 'DELETE' });
      },
      config(id: string, signupOpen: boolean, capacity?: number): Promise<unknown> {
        return request(`/member/events/${id}/config`, json('PATCH', { signupOpen, capacity }));
      },
    },

    kanban: {
      board(projectId: string): Promise<KanbanBoard> {
        return request(`/member/kanban/${projectId}`);
      },
      createTask(projectId: string, data: Record<string, unknown>): Promise<unknown> {
        return request(`/member/kanban/${projectId}/tasks`, json('POST', data));
      },
      updateTask(taskId: string, data: Record<string, unknown>): Promise<unknown> {
        return request(`/member/kanban/tasks/${taskId}`, json('PATCH', data));
      },
      removeTask(taskId: string): Promise<unknown> {
        return request(`/member/kanban/tasks/${taskId}`, { method: 'DELETE' });
      },
      createMilestone(projectId: string, data: { title: string; dueAt?: string }): Promise<unknown> {
        return request(`/member/kanban/${projectId}/milestones`, json('POST', data));
      },
      toggleMilestone(id: string): Promise<unknown> {
        return request(`/member/kanban/milestones/${id}/toggle`, { method: 'PATCH' });
      },
      removeMilestone(id: string): Promise<unknown> {
        return request(`/member/kanban/milestones/${id}`, { method: 'DELETE' });
      },
    },

    hackathons: {
      list(): Promise<HackathonRow[]> {
        return request('/member/hackathons');
      },
      create(data: Record<string, unknown>): Promise<unknown> {
        return request('/member/hackathons', json('POST', data));
      },
      setStatus(id: string, status: HackathonStatus): Promise<unknown> {
        return request(`/member/hackathons/${id}/status`, json('PATCH', { status }));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/hackathons/${id}`, { method: 'DELETE' });
      },
      createTeam(id: string, name: string, idea?: string): Promise<unknown> {
        return request(`/member/hackathons/${id}/teams`, json('POST', { name, idea }));
      },
      joinTeam(teamId: string): Promise<unknown> {
        return request(`/member/hackathons/teams/${teamId}/join`, { method: 'POST' });
      },
      leaveTeam(teamId: string): Promise<unknown> {
        return request(`/member/hackathons/teams/${teamId}/join`, { method: 'DELETE' });
      },
      submit(teamId: string, data: Record<string, unknown>): Promise<unknown> {
        return request(`/member/hackathons/teams/${teamId}/submit`, json('PATCH', data));
      },
      score(teamId: string, score: number, rank?: number): Promise<unknown> {
        return request(`/member/hackathons/teams/${teamId}/score`, json('PATCH', { score, rank }));
      },
    },

    portfolio: {
      gallery(onlyPublic = false): Promise<PortfolioItem[]> {
        return request(`/member/portfolio${onlyPublic ? '?public=true' : ''}`);
      },
      setPublic(projectId: string, isPublic: boolean): Promise<unknown> {
        return request(`/member/portfolio/${projectId}/public`, json('PATCH', { isPublic }));
      },
      setThumbnail(projectId: string, thumbnailUrl: string): Promise<unknown> {
        return request(`/member/portfolio/${projectId}/thumbnail`, json('PATCH', { thumbnailUrl }));
      },
    },

    communityHub(): Promise<CommunityHub> {
      return request('/member/community');
    },

    chat: {
      rooms(): Promise<ChatRoomRow[]> {
        return request('/member/chat/rooms');
      },
      history(slug: string, take = 60): Promise<ChatMessageRow[]> {
        return request(`/member/chat/rooms/${slug}/messages?take=${take}`);
      },
      /** WebSocket이 막힌 환경용 폴백 */
      post(slug: string, body: string): Promise<ChatMessageRow | null> {
        return request(`/member/chat/rooms/${slug}/messages`, json('POST', { body }));
      },
      socketUrl(): string {
        const base = new URL(SITE.apiBase, location.href);
        base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
        base.pathname = `${base.pathname.replace(/\/$/, '')}/chat`;
        return base.toString();
      },
      createRoom(data: { slug: string; name: string; description?: string }): Promise<unknown> {
        return request('/member/chat/rooms', json('POST', data));
      },
      removeRoom(id: string): Promise<unknown> {
        return request(`/member/chat/rooms/${id}`, { method: 'DELETE' });
      },
    },

    dues: {
      page(): Promise<DuesPage> {
        return request('/member/dues');
      },
      createTerm(data: { name: string; amount: number; dueDate: string }): Promise<unknown> {
        return request('/member/dues/terms', json('POST', data));
      },
      removeTerm(id: string): Promise<unknown> {
        return request(`/member/dues/terms/${id}`, { method: 'DELETE' });
      },
      setPaid(
        termId: string,
        userId: string,
        paid: boolean,
        amount: number,
        method?: string,
      ): Promise<unknown> {
        return request(
          `/member/dues/terms/${termId}/paid`,
          json('PATCH', { userId, paid, amount, method }),
        );
      },
      addExpense(data: Record<string, unknown>): Promise<unknown> {
        return request('/member/dues/expenses', json('POST', data));
      },
      removeExpense(id: string): Promise<unknown> {
        return request(`/member/dues/expenses/${id}`, { method: 'DELETE' });
      },
    },

    certificate: {
      preview(): Promise<CertificateData> {
        return request('/member/certificate');
      },
      mine(): Promise<Array<{ code: string; issuedAt: string }>> {
        return request('/member/certificate/mine');
      },
      issue(): Promise<CertificateData> {
        return request('/member/certificate/issue', { method: 'POST' });
      },
      verify(code: string): Promise<CertificateData> {
        return request(`/member/certificate/verify/${encodeURIComponent(code)}`);
      },
    },

    github: {
      mine(refresh = false): Promise<GithubActivity> {
        return request(`/member/github${refresh ? '?refresh=true' : ''}`);
      },
      club(): Promise<ClubGithubRow[]> {
        return request('/member/github/club');
      },
      user(login: string): Promise<GithubActivity> {
        return request(`/member/github/user/${encodeURIComponent(login)}`);
      },
    },

    contests: {
      list(params: { q?: string; open?: boolean; bookmarked?: boolean } = {}): Promise<ContestRow[]> {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.open) qs.set('open', 'true');
        if (params.bookmarked) qs.set('bookmarked', 'true');
        return request(`/member/contests${qs.size ? `?${qs}` : ''}`);
      },
      bookmark(id: string): Promise<{ bookmarked: boolean }> {
        return request(`/member/contests/${id}/bookmark`, { method: 'POST' });
      },
      add(data: Record<string, unknown>): Promise<unknown> {
        return request('/member/contests', json('POST', data));
      },
      remove(id: string): Promise<unknown> {
        return request(`/member/contests/${id}`, { method: 'DELETE' });
      },
      feeds(): Promise<ContestFeedRow[]> {
        return request('/member/contests/feeds/list');
      },
      addFeed(name: string, url: string): Promise<unknown> {
        return request('/member/contests/feeds', json('POST', { name, url }));
      },
      removeFeed(id: string): Promise<unknown> {
        return request(`/member/contests/feeds/${id}`, { method: 'DELETE' });
      },
      refresh(): Promise<{ feeds: number; added: number; errors: string[] }> {
        return request('/member/contests/refresh', { method: 'POST' });
      },
    },

    ai: {
      status(): Promise<{ enabled: boolean }> {
        return request('/member/ai/status');
      },
      ask(question: string): Promise<AiAnswer> {
        return request('/member/ai/ask', json('POST', { question }));
      },
    },

    activity: {
      timeline(params: { take?: number; kinds?: string[] } = {}): Promise<ActivityItem[]> {
        const qs = new URLSearchParams();
        if (params.take) qs.set('take', String(params.take));
        if (params.kinds?.length) qs.set('kinds', params.kinds.join(','));
        return request(`/member/activity${qs.size ? `?${qs}` : ''}`);
      },
      mine(): Promise<MyActivity> {
        return request('/member/activity/me');
      },
    },
  },

  /* ---------- 관리자 ---------- */
  admin: {
    dashboard(): Promise<AdminDashboard> {
      return request('/admin/dashboard');
    },
    users: {
      list(params: { q?: string; role?: Role | ''; locked?: '' | 'true' | 'false' } = {}): Promise<AdminUserRow[]> {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.role) qs.set('role', params.role);
        if (params.locked) qs.set('locked', params.locked);
        return request(`/admin/users${qs.size ? `?${qs}` : ''}`);
      },
      changeRole(
        id: string,
        role: Role,
        reason?: string,
        generation?: number,
      ): Promise<AdminUserRow[]> {
        return request(`/admin/users/${id}/role`, json('PATCH', { role, reason, generation }));
      },
      setLock(id: string, locked: boolean, reason?: string): Promise<unknown> {
        return request(`/admin/users/${id}/lock`, json('PATCH', { locked, reason }));
      },
      forceLogout(id: string): Promise<unknown> {
        return request(`/admin/users/${id}/force-logout`, { method: 'POST' });
      },
    },
    whitelist: {
      list(): Promise<WhitelistRow[]> {
        return request('/admin/whitelist');
      },
      add(
        studentIds: string[],
        generation?: number,
        note?: string,
      ): Promise<{ added: number; promoted: number; invalid: string[] }> {
        return request('/admin/whitelist', json('POST', { studentIds, generation, note }));
      },
      remove(studentId: string, reason?: string): Promise<{ demoted: boolean }> {
        const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        return request(`/admin/whitelist/${studentId}${qs}`, { method: 'DELETE' });
      },
    },
    logs: {
      access(params: Record<string, string> = {}): Promise<{ total: number; items: AccessLogRow[] }> {
        const qs = new URLSearchParams(params);
        return request(`/admin/logs/access${qs.size ? `?${qs}` : ''}`);
      },
      audit(params: Record<string, string> = {}): Promise<{ total: number; items: AuditLogRow[] }> {
        const qs = new URLSearchParams(params);
        return request(`/admin/logs/audit${qs.size ? `?${qs}` : ''}`);
      },
      async exportCsv(kind: 'access' | 'audit'): Promise<Blob> {
        const res = await fetch(`${SITE.apiBase}/admin/logs/${kind}/export`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
          throw new ApiError(res.status, body.code ?? 'INTERNAL', body.message ?? '내보내기 실패');
        }
        return res.blob();
      },
    },
    rack: {
      list(): Promise<RackDeviceRow[]> {
        return request('/admin/rack');
      },
      create(data: Record<string, unknown>): Promise<unknown> {
        return request('/admin/rack', json('POST', data));
      },
      update(id: string, data: Record<string, unknown>): Promise<unknown> {
        return request(`/admin/rack/${id}`, json('PATCH', data));
      },
      remove(id: string): Promise<unknown> {
        return request(`/admin/rack/${id}`, { method: 'DELETE' });
      },
      ping(id: string): Promise<{ ok: boolean; lastSeenAt: string | null }> {
        return request(`/admin/rack/${id}/ping`, { method: 'POST' });
      },
    },
    settings: {
      get(): Promise<SiteSettings> {
        return request('/admin/settings');
      },
      patch(data: unknown): Promise<SiteSettings> {
        return request('/admin/settings', json('PATCH', data));
      },
    },
    db: {
      unlock(passphrase: string): Promise<{ ok: true; expiresInSec: number }> {
        return request('/admin/db/unlock', json('POST', { passphrase }));
      },
      query(sql: string): Promise<{ rows: unknown[]; truncated: boolean }> {
        return request('/admin/db/query', json('POST', { sql }));
      },
    },
    applications: {
      list(
        params: { q?: string; interest?: string; order?: 'asc' | 'desc' } = {},
      ): Promise<AdminListResult> {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.interest) qs.set('interest', params.interest);
        if (params.order) qs.set('order', params.order);
        return request(`/admin/applications${qs.size ? `?${qs}` : ''}`);
      },
      detail(id: string): Promise<AdminApplicationDetail> {
        return request(`/admin/applications/${id}`);
      },
      async exportCsv(): Promise<Blob> {
        const res = await fetch(`${SITE.apiBase}/admin/applications/export`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
          throw new ApiError(res.status, body.code ?? 'INTERNAL', body.message ?? '내보내기 실패');
        }
        return res.blob();
      },
    },
  },
};
