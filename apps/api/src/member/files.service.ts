import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, FILE_CATEGORIES, type FileRow } from '@sowl/shared';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — 실제 제한은 동아리 확인 후 조정
const BLOCKED_EXT = new Set(['.exe', '.bat', '.cmd', '.msi', '.scr', '.com', '.ps1']);

export function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * studyId 를 주면 그 스터디 자료실, 주지 않으면 공용 자료실(studyId = null)만 돌려준다.
   * 두 화면이 서로의 파일을 섞어 보여주지 않도록 항상 한쪽으로 좁힌다.
   */
  async list(category?: string, q?: string, studyId?: string): Promise<FileRow[]> {
    const files = await this.prisma.sharedFile.findMany({
      where: {
        studyId: studyId ?? null,
        ...(category ? { category } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        uploader: { select: { name: true } },
        study: { select: { title: true } },
      },
    });
    return files.map((f) => ({
      id: f.id,
      category: f.category,
      name: f.name,
      size: f.size,
      mime: f.mime,
      uploaderId: f.uploaderId,
      uploaderName: f.uploader.name,
      downloads: f.downloads,
      createdAt: f.createdAt.toISOString(),
      studyId: f.studyId,
      studyTitle: f.study?.title ?? null,
    }));
  }

  async save(
    uploaderId: string,
    category: string,
    file: Express.Multer.File,
    studyId?: string,
  ): Promise<FileRow> {
    // multer는 originalname을 latin1로 넘긴다 — 한글 파일명 복원
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = extname(name).toLowerCase();
    if (BLOCKED_EXT.has(ext)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '실행 파일은 업로드할 수 없습니다.',
      });
    }
    const cat = FILE_CATEGORIES.includes(category) ? category : '기타';
    const storedName = `${randomBytes(12).toString('hex')}${ext}`;
    await writeFile(join(uploadDir(), storedName), file.buffer);
    const saved = await this.prisma.sharedFile.create({
      data: {
        category: cat,
        name,
        storedName,
        size: file.size,
        mime: file.mimetype || 'application/octet-stream',
        uploaderId,
        studyId: studyId || null,
      },
      include: {
        uploader: { select: { name: true } },
        study: { select: { title: true } },
      },
    });
    return {
      id: saved.id,
      category: saved.category,
      name: saved.name,
      size: saved.size,
      mime: saved.mime,
      uploaderId: saved.uploaderId,
      uploaderName: saved.uploader.name,
      downloads: saved.downloads,
      createdAt: saved.createdAt.toISOString(),
      studyId: saved.studyId,
      studyTitle: saved.study?.title ?? null,
    };
  }

  async forDownload(id: string): Promise<{ path: string; name: string; mime: string }> {
    const f = await this.prisma.sharedFile.findUnique({ where: { id } });
    if (!f) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '파일을 찾을 수 없습니다.',
      });
    }
    await this.prisma.sharedFile.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });
    return { path: join(uploadDir(), f.storedName), name: f.name, mime: f.mime };
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const f = await this.prisma.sharedFile.findUnique({ where: { id } });
    if (!f) return;
    if (f.uploaderId !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.MEMBER_ONLY,
        message: '본인이 올린 파일만 삭제할 수 있습니다.',
      });
    }
    await this.prisma.sharedFile.delete({ where: { id } });
    await unlink(join(uploadDir(), f.storedName)).catch(() => undefined);
  }
}
