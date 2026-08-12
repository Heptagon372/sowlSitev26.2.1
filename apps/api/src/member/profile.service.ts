import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { ERROR_CODES, USER_VALIDATION, checkPassword } from '@sowl/shared';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async update(
    userId: string,
    data: {
      name?: string;
      email?: string | null;
      department?: string | null;
      bio?: string | null;
      techStack?: string[];
      githubLogin?: string | null;
    },
  ): Promise<User> {
    if (data.name !== undefined && !USER_VALIDATION.namePattern.test(data.name)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '이름은 2~10자의 한글 또는 영문이어야 합니다.',
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.department !== undefined ? { department: data.department || null } : {}),
        ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
        ...(data.techStack !== undefined
          ? { techStack: data.techStack.map((t) => t.trim()).filter(Boolean).slice(0, 20) }
          : {}),
        ...(data.githubLogin !== undefined ? { githubLogin: data.githubLogin || null } : {}),
      },
    });
  }

  /** 비밀번호 변경 — 현재 비밀번호 확인 후 같은 규칙(8자+특수문자)으로 재해시 */
  async changePassword(user: User, current: string, next: string): Promise<void> {
    const ok = await argon2.verify(user.passwordHash, current).catch(() => false);
    if (!ok) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHENTICATED,
        message: '현재 비밀번호가 올바르지 않습니다.',
      });
    }
    if (!checkPassword(next).ok) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: '새 비밀번호는 8자 이상이며 특수문자를 1자 이상 포함해야 합니다.',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(next, { type: argon2.argon2id }) },
    });
  }
}
