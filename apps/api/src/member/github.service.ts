import { Injectable, Logger } from '@nestjs/common';
import type { ClubGithubRow, GithubActivity } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_MINUTES = 30;

interface GhProfile {
  name: string | null;
  avatar_url: string;
  bio: string | null;
  followers: number;
  public_repos: number;
  html_url: string;
}
interface GhRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  pushed_at: string;
  fork: boolean;
}
interface GhEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: { commits?: unknown[]; action?: string; ref_type?: string };
}

type CachedPayload = Omit<GithubActivity, 'linked' | 'fetchedAt' | 'error'>;

/**
 * #14 GitHub 연동 — 공개 정보만 읽는다.
 * 비인증 GitHub API는 시간당 60회 제한이라 30분 캐시를 둔다.
 * GITHUB_TOKEN 이 설정되어 있으면 한도가 5000회로 올라간다(선택).
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger('GitHub');

  constructor(private readonly prisma: PrismaService) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sowl-website',
    };
    if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    return h;
  }

  async activity(login: string | null, force = false): Promise<GithubActivity> {
    if (!login) {
      return {
        login: '',
        linked: false,
        profile: null,
        repos: [],
        events: [],
        fetchedAt: null,
        error: null,
      };
    }

    const cached = await this.prisma.githubCache.findUnique({ where: { login } });
    const fresh =
      cached && Date.now() - cached.fetchedAt.getTime() < CACHE_MINUTES * 60_000 && !force;
    if (fresh) {
      const data = cached.data as unknown as CachedPayload;
      return {
        ...data,
        linked: true,
        fetchedAt: cached.fetchedAt.toISOString(),
        error: null,
      };
    }

    try {
      const payload = await this.fetchAll(login);
      await this.prisma.githubCache.upsert({
        where: { login },
        update: { data: JSON.parse(JSON.stringify(payload)) as object, fetchedAt: new Date() },
        create: { login, data: JSON.parse(JSON.stringify(payload)) as object },
      });
      return { ...payload, linked: true, fetchedAt: new Date().toISOString(), error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'GitHub 조회 실패';
      this.logger.warn(`${login}: ${message}`);
      // 실패해도 오래된 캐시가 있으면 그거라도 보여준다
      if (cached) {
        const data = cached.data as unknown as CachedPayload;
        return {
          ...data,
          linked: true,
          fetchedAt: cached.fetchedAt.toISOString(),
          error: `최신 정보를 못 가져왔습니다 (${message}). 캐시를 보여줍니다.`,
        };
      }
      return {
        login,
        linked: true,
        profile: null,
        repos: [],
        events: [],
        fetchedAt: null,
        error: message,
      };
    }
  }

  private async fetchAll(login: string): Promise<CachedPayload> {
    const get = async <T>(path: string): Promise<T> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`https://api.github.com${path}`, {
          headers: this.headers(),
          signal: controller.signal,
        });
        if (res.status === 404) throw new Error('없는 GitHub 계정입니다');
        if (res.status === 403) throw new Error('GitHub API 호출 한도 초과');
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        return (await res.json()) as T;
      } finally {
        clearTimeout(timer);
      }
    };

    const encoded = encodeURIComponent(login);
    const [profile, repos, events] = await Promise.all([
      get<GhProfile>(`/users/${encoded}`),
      get<GhRepo[]>(`/users/${encoded}/repos?sort=pushed&per_page=8`),
      get<GhEvent[]>(`/users/${encoded}/events/public?per_page=20`),
    ]);

    return {
      login,
      profile: {
        name: profile.name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        followers: profile.followers,
        publicRepos: profile.public_repos,
        htmlUrl: profile.html_url,
      },
      repos: repos
        .filter((r) => !r.fork)
        .slice(0, 6)
        .map((r) => ({
          name: r.name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          url: r.html_url,
          pushedAt: r.pushed_at,
        })),
      events: events.slice(0, 12).map((e) => ({
        type: e.type,
        repo: e.repo.name,
        at: e.created_at,
        detail:
          e.type === 'PushEvent'
            ? `커밋 ${e.payload.commits?.length ?? 0}개`
            : (e.payload.action ?? e.payload.ref_type ?? null),
      })),
    };
  }

  /** 동아리 전체 GitHub 연결 현황 (캐시된 값만 — 여기서 새로 호출하면 한도를 금방 쓴다) */
  async club(): Promise<ClubGithubRow[]> {
    const users = await this.prisma.user.findMany({
      where: { githubLogin: { not: null }, role: { in: ['MEMBER', 'ADMIN'] } },
      select: { id: true, name: true, githubLogin: true },
    });
    const caches = await this.prisma.githubCache.findMany({
      where: { login: { in: users.map((u) => u.githubLogin!) } },
    });
    const byLogin = new Map(caches.map((c) => [c.login, c.data as unknown as CachedPayload]));
    return users.map((u) => {
      const data = byLogin.get(u.githubLogin!);
      return {
        userId: u.id,
        name: u.name,
        login: u.githubLogin!,
        publicRepos: data?.profile?.publicRepos ?? 0,
        followers: data?.profile?.followers ?? 0,
        lastPushAt: data?.repos[0]?.pushedAt ?? null,
      };
    });
  }
}
