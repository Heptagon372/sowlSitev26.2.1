import { Injectable, Logger } from '@nestjs/common';
import type { ContestFeedRow, ContestRow } from '@sowl/shared';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';

interface FeedItem {
  title?: string;
  link?: string | { '@_href'?: string };
  description?: string;
  summary?: string;
  pubDate?: string;
  updated?: string;
  published?: string;
  category?: string | string[];
}

/**
 * #30 공모전 확인 — 임의의 사이트를 긁지 않는다.
 * 설계도 ② §15에서 크롤링 대상·robots.txt가 미확인 상태이므로,
 * 사이트가 스스로 공개한 RSS/Atom 피드만 읽고 나머지는 관리자 수동 등록으로 채운다.
 * 대상 사이트가 확정되면 여기에 전용 파서를 붙이면 된다.
 */
@Injectable()
export class ContestsService {
  private readonly logger = new Logger('Contests');
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    filter: { q?: string; onlyOpen?: boolean; onlyBookmarked?: boolean } = {},
  ): Promise<ContestRow[]> {
    const contests = await this.prisma.contest.findMany({
      where: {
        ...(filter.q
          ? {
              OR: [
                { title: { contains: filter.q, mode: 'insensitive' as const } },
                { host: { contains: filter.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(filter.onlyOpen ? { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] } : {}),
        ...(filter.onlyBookmarked ? { bookmarks: { some: { userId } } } : {}),
      },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: { bookmarks: { where: { userId }, select: { userId: true } } },
    });

    const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
    return contests.map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      host: c.host,
      category: c.category,
      prize: c.prize,
      summary: c.summary,
      deadline: c.deadline?.toISOString() ?? null,
      source: c.source as 'MANUAL' | 'FEED',
      bookmarked: c.bookmarks.length > 0,
      dday: c.deadline
        ? Math.round((midnight(c.deadline.getTime()) - midnight(Date.now())) / 86_400_000)
        : null,
    }));
  }

  async toggleBookmark(contestId: string, userId: string): Promise<{ bookmarked: boolean }> {
    const key = { contestId_userId: { contestId, userId } };
    const existing = await this.prisma.contestBookmark.findUnique({ where: key });
    if (existing) {
      await this.prisma.contestBookmark.delete({ where: key });
      return { bookmarked: false };
    }
    await this.prisma.contestBookmark.create({ data: { contestId, userId } });
    return { bookmarked: true };
  }

  add(data: {
    title: string;
    url: string;
    host?: string;
    category?: string;
    prize?: string;
    summary?: string;
    deadline?: string;
  }) {
    return this.prisma.contest.upsert({
      where: { url: data.url },
      update: {
        title: data.title,
        host: data.host ?? null,
        category: data.category ?? null,
        prize: data.prize ?? null,
        summary: data.summary ?? null,
        deadline: data.deadline ? new Date(data.deadline) : null,
      },
      create: {
        title: data.title,
        url: data.url,
        host: data.host ?? null,
        category: data.category ?? null,
        prize: data.prize ?? null,
        summary: data.summary ?? null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        source: 'MANUAL',
      },
    });
  }

  remove(id: string) {
    return this.prisma.contest.delete({ where: { id } });
  }

  /* ---------- RSS/Atom 피드 ---------- */

  async feeds(): Promise<ContestFeedRow[]> {
    const rows = await this.prisma.contestFeed.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      enabled: f.enabled,
      lastFetchedAt: f.lastFetchedAt?.toISOString() ?? null,
      lastError: f.lastError,
    }));
  }

  addFeed(name: string, url: string) {
    return this.prisma.contestFeed.create({ data: { name, url } });
  }

  removeFeed(id: string) {
    return this.prisma.contestFeed.delete({ where: { id } });
  }

  /** 등록된 피드를 모두 읽어 새 공모전을 채운다 (관리자가 누를 때만 동작) */
  async refresh(): Promise<{ feeds: number; added: number; errors: string[] }> {
    const feeds = await this.prisma.contestFeed.findMany({ where: { enabled: true } });
    const errors: string[] = [];
    let added = 0;

    for (const feed of feeds) {
      try {
        const items = await this.readFeed(feed.url);
        for (const item of items) {
          const link =
            typeof item.link === 'string' ? item.link : (item.link?.['@_href'] ?? undefined);
          const title = typeof item.title === 'string' ? item.title.trim() : '';
          if (!link || !title) continue;

          const dateText = item.pubDate ?? item.published ?? item.updated;
          const parsed = dateText ? new Date(dateText) : null;
          const summaryRaw = item.description ?? item.summary ?? '';
          const summary =
            typeof summaryRaw === 'string'
              ? summaryRaw.replace(/<[^>]*>/g, '').trim().slice(0, 400)
              : null;

          const existing = await this.prisma.contest.findUnique({ where: { url: link } });
          if (existing) continue;

          await this.prisma.contest.create({
            data: {
              title: title.slice(0, 200),
              url: link,
              host: feed.name,
              summary: summary || null,
              category: Array.isArray(item.category) ? item.category[0] : (item.category ?? null),
              // 피드에는 마감일이 없는 경우가 많다 — 발행일만 있으면 마감일은 비워 둔다
              deadline: null,
              source: 'FEED',
              feedId: feed.id,
              createdAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
            },
          });
          added += 1;
        }
        await this.prisma.contestFeed.update({
          where: { id: feed.id },
          data: { lastFetchedAt: new Date(), lastError: null },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : '수집 실패';
        errors.push(`${feed.name}: ${message}`);
        await this.prisma.contestFeed.update({
          where: { id: feed.id },
          data: { lastFetchedAt: new Date(), lastError: message.slice(0, 200) },
        });
      }
    }
    return { feeds: feeds.length, added, errors };
  }

  private async readFeed(url: string): Promise<FeedItem[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'sowl-website (club contest board)' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const doc = this.parser.parse(xml) as {
        rss?: { channel?: { item?: FeedItem | FeedItem[] } };
        feed?: { entry?: FeedItem | FeedItem[] };
      };
      const raw = doc.rss?.channel?.item ?? doc.feed?.entry ?? [];
      return (Array.isArray(raw) ? raw : [raw]).slice(0, 40);
    } finally {
      clearTimeout(timer);
    }
  }
}
