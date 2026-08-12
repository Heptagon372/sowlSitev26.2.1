import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, type PostDetail, type PostRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

const rowInclude = {
  author: { select: { name: true } },
  _count: { select: { likes: true, comments: true } },
} as const;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, pageSize = 20): Promise<{ total: number; items: PostRow[] }> {
    const [total, posts] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(1, page) - 1) * pageSize,
        take: pageSize,
        include: { ...rowInclude, likes: { where: { userId }, select: { userId: true } } },
      }),
    ]);
    return {
      total,
      items: posts.map((p) => ({
        id: p.id,
        title: p.title,
        authorId: p.authorId,
        authorName: p.author.name,
        createdAt: p.createdAt.toISOString(),
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        likedByMe: p.likes.length > 0,
      })),
    };
  }

  async detail(id: string, userId: string): Promise<PostDetail> {
    const p = await this.prisma.post.findUnique({
      where: { id },
      include: {
        ...rowInclude,
        likes: { where: { userId }, select: { userId: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (!p) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '게시글을 찾을 수 없습니다.',
      });
    }
    return {
      id: p.id,
      title: p.title,
      body: p.body,
      authorId: p.authorId,
      authorName: p.author.name,
      createdAt: p.createdAt.toISOString(),
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.length > 0,
      comments: p.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        authorName: c.author.name,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  create(authorId: string, title: string, body: string) {
    return this.prisma.post.create({ data: { authorId, title, body } });
  }

  /** 본인 글 또는 관리자만 삭제 */
  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) return;
    if (post.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '본인이 쓴 글만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.post.delete({ where: { id } });
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const key = { postId_userId: { postId, userId } };
    const existing = await this.prisma.postLike.findUnique({ where: key });
    if (existing) await this.prisma.postLike.delete({ where: key });
    else await this.prisma.postLike.create({ data: { postId, userId } });
    const likeCount = await this.prisma.postLike.count({ where: { postId } });
    return { liked: !existing, likeCount };
  }

  addComment(postId: string, authorId: string, body: string) {
    return this.prisma.comment.create({ data: { postId, authorId, body } });
  }

  async removeComment(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const c = await this.prisma.comment.findUnique({ where: { id }, select: { authorId: true } });
    if (!c) return;
    if (c.authorId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '본인이 쓴 댓글만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.comment.delete({ where: { id } });
  }
}
