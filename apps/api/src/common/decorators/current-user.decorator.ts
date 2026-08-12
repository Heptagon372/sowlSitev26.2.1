import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { SessionUser } from '@sowl/shared';
import type { AuthedRequest } from '../guards/auth.guards';

/** AuthGuard 계열이 붙은 핸들러에서 현재 유저를 꺼낸다 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

/** User → 프론트에 내려줄 SessionUser (passwordHash 등 내부 필드 제거) */
export function toSessionUser(u: User): SessionUser {
  return {
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    role: u.role,
    generation: u.generation,
    email: u.email,
    department: u.department,
    bio: u.bio,
    techStack: u.techStack,
    githubLogin: u.githubLogin,
    avatarUrl: u.avatarUrl,
    points: u.points,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}
