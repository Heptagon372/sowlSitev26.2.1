import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { AiAnswer, AiSource } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * #29 S.OWL AI — 동아리 자료 기반 Q&A.
 *
 * 두 단계로 나뉜다:
 *  1) 검색 — 공지·자료·Q&A·스터디·세미나·게시글·프로젝트에서 관련 내용을 모은다.
 *  2) 답변 — ANTHROPIC_API_KEY 가 있으면 Claude가 1)의 근거만 보고 답한다.
 *
 * 키가 없으면 2)를 건너뛰고 검색 결과만 돌려준다 (mode: 'search').
 * 없는 기능을 있는 척하지 않기 위해 화면에도 어느 쪽인지 표시한다.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger('SowlAI');
  private readonly client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

  constructor(private readonly prisma: PrismaService) {}

  get enabled(): boolean {
    return this.client !== null;
  }

  async ask(question: string, userId: string): Promise<AiAnswer> {
    const sources = await this.search(question, userId);

    if (!this.client) {
      return {
        question,
        answer: sources.length
          ? '동아리 자료에서 찾은 관련 내용입니다. (AI 답변은 서버에 ANTHROPIC_API_KEY 가 설정되면 켜집니다)'
          : '관련된 동아리 자료를 찾지 못했습니다. 다른 표현으로 검색해 보세요.',
        sources,
        mode: 'search',
      };
    }

    if (sources.length === 0) {
      return {
        question,
        answer:
          '동아리 자료에서 관련 내용을 찾지 못했습니다. 공지·자료실·Q&A에 없는 내용은 답변할 수 없어요.',
        sources: [],
        mode: 'search',
      };
    }

    try {
      const answer = await this.answerWithClaude(question, sources);
      return { question, answer, sources, mode: 'claude' };
    } catch (e) {
      this.logger.warn(`Claude 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return {
        question,
        answer: 'AI 답변을 생성하지 못했습니다. 아래 관련 자료를 직접 확인해 주세요.',
        sources,
        mode: 'search',
      };
    }
  }

  /** 동아리 콘텐츠에서 질문과 겹치는 것을 모은다 (한국어라 형태소 분석 없이 부분 일치로 충분) */
  private async search(question: string, userId: string): Promise<AiSource[]> {
    const terms = question
      .toLowerCase()
      .split(/[\s,.?!·]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 8);
    if (terms.length === 0) return [];

    const anyTerm = <T extends string>(field: T) =>
      terms.map((t) => ({ [field]: { contains: t, mode: 'insensitive' as const } }));

    const [notices, questions, studies, seminars, posts, projects, files] = await Promise.all([
      this.prisma.notice.findMany({
        where: { OR: [...anyTerm('title'), ...anyTerm('body')] },
        take: 4,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.findMany({
        where: { OR: [...anyTerm('title'), ...anyTerm('body')] },
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: {
          answers: { orderBy: { createdAt: 'asc' }, take: 2 },
        },
      }),
      this.prisma.study.findMany({
        where: { OR: [...anyTerm('title'), ...anyTerm('description')] },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.seminar.findMany({
        where: { OR: [...anyTerm('title'), ...anyTerm('description')] },
        take: 3,
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.post.findMany({
        where: { OR: [...anyTerm('title'), ...anyTerm('body')] },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.findMany({
        where: { OR: [...anyTerm('name'), ...anyTerm('summary')] },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sharedFile.findMany({
        where: { OR: anyTerm('name') },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const clip = (s: string, n = 400) => s.replace(/\s+/g, ' ').trim().slice(0, n);

    return [
      ...notices.map((n) => ({
        kind: '공지',
        title: n.title,
        href: `/member/notice/notices.html#${n.id}`,
        snippet: clip(n.body),
      })),
      ...questions.map((q) => ({
        kind: 'Q&A',
        title: q.title,
        href: `/member/community/qna.html#${q.id}`,
        snippet: clip(
          `${q.body}${q.answers.length ? ` / 답변: ${q.answers.map((a) => a.body).join(' ')}` : ''}`,
        ),
      })),
      ...studies.map((s) => ({
        kind: '스터디',
        title: s.title,
        href: '/member/study/studies.html',
        snippet: clip(`${s.description} (${s.schedule ?? '일정 미정'})`),
      })),
      ...seminars.map((s) => ({
        kind: '세미나',
        title: s.title,
        href: '/member/study/seminars.html',
        snippet: clip(`${s.description ?? ''} ${s.startsAt.toISOString().slice(0, 10)}`),
      })),
      ...posts.map((p) => ({
        kind: '게시글',
        title: p.title,
        href: `/member/community/board.html#${p.id}`,
        snippet: clip(p.body),
      })),
      ...projects.map((p) => ({
        kind: '프로젝트',
        title: p.name,
        href: '/member/project/projects.html',
        snippet: clip(`${p.summary} 기술: ${p.techStack.join(', ')}`),
      })),
      ...files.map((f) => ({
        kind: '자료',
        title: f.name,
        href: '/member/study/files.html',
        snippet: `${f.category} 자료 · ${(f.size / 1024).toFixed(0)}KB`,
      })),
    ].slice(0, 12);
  }

  private async answerWithClaude(question: string, sources: AiSource[]): Promise<string> {
    const context = sources
      .map((s, i) => `[${i + 1}] (${s.kind}) ${s.title}\n${s.snippet}`)
      .join('\n\n');

    const response = await this.client!.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2048,
      // 안전 분류기가 요청을 거절하면 서버가 대체 모델로 한 번 더 시도한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system:
        'You answer questions for members of SLEEPY OWL (S.OWL), a university IT club, ' +
        'using only the club documents provided in the user message. ' +
        'Answer in Korean, in a friendly but concise tone — a few sentences, no headings. ' +
        'Cite the documents you used as [1], [2] inline. ' +
        'If the documents do not contain the answer, say so plainly and suggest where in the club space to look ' +
        'instead of guessing. Never invent club facts, dates, names, or numbers that are not in the documents.',
      messages: [
        {
          role: 'user',
          content: `동아리 자료:\n\n${context}\n\n---\n질문: ${question}`,
        },
      ],
    });

    // 거절은 HTTP 200으로 온다 — content를 읽기 전에 반드시 확인한다
    if (response.stop_reason === 'refusal') {
      return '이 질문에는 답변할 수 없습니다. 아래 관련 자료를 직접 확인해 주세요.';
    }

    return (
      response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim() || '답변을 생성하지 못했습니다. 아래 자료를 확인해 주세요.'
    );
  }
}
