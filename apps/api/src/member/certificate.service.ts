import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type CertificateData } from '@sowl/shared';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SeminarsService } from './seminars.service';

/**
 * #25 수료 / 활동 인증 — 발급 시점의 활동을 스냅샷으로 굳혀 두고,
 * 확인 번호(code)로 나중에 진위를 조회할 수 있게 한다.
 * PDF는 서버에서 만들지 않는다 — 한글 폰트를 번들해야 해서 무겁고,
 * 브라우저 인쇄(PDF로 저장)로 충분하며 서식도 그대로 나온다.
 */
@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seminars: SeminarsService,
  ) {}

  private async snapshot(userId: string) {
    const [user, studies, attendance, missions, projects, posts] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.studyMember.count({ where: { userId } }),
      this.seminars.myStats(userId),
      this.prisma.missionSubmission.count({ where: { userId } }),
      this.prisma.projectMember.count({ where: { userId } }),
      this.prisma.post.count({ where: { authorId: userId } }),
    ]);
    return {
      user,
      stats: {
        studies,
        seminarsAttended: attendance.attended,
        seminarRate: attendance.rate,
        missions,
        projects,
        posts,
        points: user.points,
      },
    };
  }

  /** 미리보기 — 발급하지 않고 지금 값으로만 보여준다 */
  async preview(userId: string): Promise<CertificateData> {
    const { user, stats } = await this.snapshot(userId);
    return {
      code: '(미발급)',
      issuedAt: new Date().toISOString(),
      name: user.name,
      studentId: user.studentId,
      generation: user.generation,
      joinedAt: user.createdAt.toISOString(),
      stats,
      highlights: this.highlights(stats),
    };
  }

  async issue(userId: string): Promise<CertificateData> {
    const { user, stats } = await this.snapshot(userId);
    const code = `SOWL-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const cert = await this.prisma.certificate.create({
      data: {
        code,
        userId,
        generation: user.generation,
        summary: JSON.parse(JSON.stringify(stats)) as object,
      },
    });
    return {
      code: cert.code,
      issuedAt: cert.issuedAt.toISOString(),
      name: user.name,
      studentId: user.studentId,
      generation: user.generation,
      joinedAt: user.createdAt.toISOString(),
      stats,
      highlights: this.highlights(stats),
    };
  }

  async mine(userId: string): Promise<Array<{ code: string; issuedAt: string }>> {
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map((r) => ({ code: r.code, issuedAt: r.issuedAt.toISOString() }));
  }

  /** 확인 번호로 진위 조회 (로그인 필요 — 외부 공개는 하지 않는다) */
  async verify(code: string): Promise<CertificateData> {
    const cert = await this.prisma.certificate.findUnique({
      where: { code },
      include: { user: { select: { name: true, studentId: true, createdAt: true } } },
    });
    if (!cert) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: '해당 번호의 활동 확인서가 없습니다.',
      });
    }
    const stats = cert.summary as CertificateData['stats'];
    return {
      code: cert.code,
      issuedAt: cert.issuedAt.toISOString(),
      name: cert.user.name,
      studentId: cert.user.studentId,
      generation: cert.generation,
      joinedAt: cert.user.createdAt.toISOString(),
      stats,
      highlights: this.highlights(stats),
    };
  }

  private highlights(s: CertificateData['stats']): string[] {
    const out: string[] = [];
    if (s.studies > 0) out.push(`스터디 ${s.studies}개 참여`);
    if (s.seminarsAttended > 0)
      out.push(`세미나 ${s.seminarsAttended}회 출석 (출석률 ${s.seminarRate}%)`);
    if (s.missions > 0) out.push(`과제 ${s.missions}건 제출`);
    if (s.projects > 0) out.push(`프로젝트 ${s.projects}개 참여`);
    if (s.posts > 0) out.push(`게시글 ${s.posts}건 작성`);
    out.push(`동아리 포인트 ${s.points}pt 적립`);
    return out;
  }
}
