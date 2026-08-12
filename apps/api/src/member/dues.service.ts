import { Injectable } from '@nestjs/common';
import type { DuesPage } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * #28 회비 / 운영비 — 내 납부 상태는 누구나, 운영비 사용 내역은 전 부원에게 공개.
 * 다른 사람의 납부 여부(미납자 명단)는 관리자에게만 내려준다.
 */
@Injectable()
export class DuesService {
  constructor(private readonly prisma: PrismaService) {}

  async page(userId: string, isAdmin: boolean): Promise<DuesPage> {
    const [terms, expenses, memberCount] = await Promise.all([
      this.prisma.duesTerm.findMany({
        orderBy: { dueDate: 'desc' },
        include: {
          payments: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.expense.findMany({
        orderBy: { spentAt: 'desc' },
        take: 200,
        include: { term: { select: { name: true } } },
      }),
      this.prisma.user.count({ where: { role: { in: ['MEMBER', 'ADMIN'] } } }),
    ]);

    const collected = terms.reduce(
      (sum, t) => sum + t.payments.filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0),
      0,
    );
    const spent = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      terms: terms.map((t) => {
        const mine = t.payments.find((p) => p.userId === userId);
        return {
          id: t.id,
          name: t.name,
          amount: t.amount,
          dueDate: t.dueDate.toISOString(),
          paidCount: t.payments.filter((p) => p.paidAt).length,
          memberCount,
          myPaidAt: mine?.paidAt?.toISOString() ?? null,
          myAmount: mine?.amount ?? 0,
        };
      }),
      expenses: expenses.map((e) => ({
        id: e.id,
        termId: e.termId,
        termName: e.term?.name ?? null,
        title: e.title,
        amount: e.amount,
        category: e.category,
        spentAt: e.spentAt.toISOString(),
        note: e.note,
      })),
      totals: { collected, spent, balance: collected - spent },
      roster: isAdmin
        ? terms.flatMap((t) =>
            t.payments.map((p) => ({
              termId: t.id,
              userId: p.userId,
              name: p.user.name,
              paidAt: p.paidAt?.toISOString() ?? null,
            })),
          )
        : [],
    };
  }

  createTerm(data: { name: string; amount: number; dueDate: string }) {
    return this.prisma.duesTerm.create({
      data: { name: data.name, amount: data.amount, dueDate: new Date(data.dueDate) },
    });
  }

  /** 학기를 만들면 현재 회원 전원에게 '미납' 행을 만들어 둔다 (명단이 곧 납부 현황) */
  async openTermForMembers(termId: string): Promise<{ created: number }> {
    const term = await this.prisma.duesTerm.findUniqueOrThrow({ where: { id: termId } });
    const members = await this.prisma.user.findMany({
      where: { role: { in: ['MEMBER', 'ADMIN'] } },
      select: { id: true },
    });
    let created = 0;
    for (const m of members) {
      const r = await this.prisma.duesPayment.upsert({
        where: { termId_userId: { termId, userId: m.id } },
        update: {},
        create: { termId, userId: m.id, amount: 0 },
      });
      if (r) created += 1;
    }
    return { created };
  }

  setPaid(termId: string, userId: string, paid: boolean, amount: number, method?: string) {
    return this.prisma.duesPayment.upsert({
      where: { termId_userId: { termId, userId } },
      update: {
        paidAt: paid ? new Date() : null,
        amount: paid ? amount : 0,
        method: method ?? null,
      },
      create: {
        termId,
        userId,
        paidAt: paid ? new Date() : null,
        amount: paid ? amount : 0,
        method: method ?? null,
      },
    });
  }

  addExpense(
    createdBy: string,
    data: {
      title: string;
      amount: number;
      category?: string;
      spentAt: string;
      termId?: string;
      note?: string;
    },
  ) {
    return this.prisma.expense.create({
      data: {
        title: data.title,
        amount: data.amount,
        category: data.category ?? '기타',
        spentAt: new Date(data.spentAt),
        termId: data.termId || null,
        note: data.note ?? null,
        createdBy,
      },
    });
  }

  removeExpense(id: string) {
    return this.prisma.expense.delete({ where: { id } });
  }

  removeTerm(id: string) {
    return this.prisma.duesTerm.delete({ where: { id } });
  }
}
