import { BadRequestException, Injectable } from '@nestjs/common';
import { ERROR_CODES, RACK_UNITS, type RackDeviceRow } from '@sowl/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface RackDeviceInput {
  name?: string;
  kind?: string;
  startUnit?: number;
  unitSize?: number;
  status?: string;
  purpose?: string | null;
  ownerId?: string | null;
  healthUrl?: string | null;
  note?: string | null;
}

@Injectable()
export class RackService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RackDeviceRow[]> {
    const devices = await this.prisma.rackDevice.findMany({
      orderBy: { startUnit: 'asc' },
    });
    const ownerIds = devices.map((d) => d.ownerId).filter((v): v is string => !!v);
    const owners = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind as RackDeviceRow['kind'],
      startUnit: d.startUnit,
      unitSize: d.unitSize,
      status: d.status as RackDeviceRow['status'],
      purpose: d.purpose,
      ownerId: d.ownerId,
      ownerName: d.ownerId ? (owners.get(d.ownerId) ?? null) : null,
      healthUrl: d.healthUrl,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      note: d.note,
    }));
  }

  /** 42U 범위·다른 장비와의 겹침 검증 */
  private async assertFits(
    startUnit: number,
    unitSize: number,
    excludeId?: string,
  ): Promise<void> {
    const end = startUnit + unitSize - 1;
    if (startUnit < 1 || unitSize < 1 || end > RACK_UNITS) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `유닛 범위가 랙(1~${RACK_UNITS}U)을 벗어납니다.`,
      });
    }
    const others = await this.prisma.rackDevice.findMany({
      where: excludeId ? { id: { not: excludeId } } : {},
      select: { name: true, startUnit: true, unitSize: true },
    });
    const clash = others.find(
      (o) => startUnit <= o.startUnit + o.unitSize - 1 && o.startUnit <= end,
    );
    if (clash) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `'${clash.name}' 장비와 유닛이 겹칩니다.`,
      });
    }
  }

  async create(input: Required<Pick<RackDeviceInput, 'name' | 'kind' | 'startUnit'>> & RackDeviceInput) {
    await this.assertFits(input.startUnit, input.unitSize ?? 1);
    return this.prisma.rackDevice.create({
      data: {
        name: input.name,
        kind: input.kind,
        startUnit: input.startUnit,
        unitSize: input.unitSize ?? 1,
        status: input.status ?? 'OK',
        purpose: input.purpose ?? null,
        ownerId: input.ownerId ?? null,
        healthUrl: input.healthUrl ?? null,
        note: input.note ?? null,
      },
    });
  }

  async update(id: string, input: RackDeviceInput) {
    const current = await this.prisma.rackDevice.findUniqueOrThrow({ where: { id } });
    const startUnit = input.startUnit ?? current.startUnit;
    const unitSize = input.unitSize ?? current.unitSize;
    await this.assertFits(startUnit, unitSize, id);
    return this.prisma.rackDevice.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        startUnit,
        unitSize,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.healthUrl !== undefined ? { healthUrl: input.healthUrl } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
  }

  remove(id: string) {
    return this.prisma.rackDevice.delete({ where: { id } });
  }

  /** 수동 헬스체크 — healthUrl에 HTTP 요청을 보내 응답하면 lastSeenAt 갱신 */
  async ping(id: string): Promise<{ ok: boolean; lastSeenAt: string | null }> {
    const device = await this.prisma.rackDevice.findUniqueOrThrow({ where: { id } });
    if (!device.healthUrl) return { ok: false, lastSeenAt: null };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(device.healthUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      const updated = await this.prisma.rackDevice.update({
        where: { id },
        data: { lastSeenAt: new Date(), status: 'OK' },
      });
      return { ok: true, lastSeenAt: updated.lastSeenAt!.toISOString() };
    } catch {
      return { ok: false, lastSeenAt: device.lastSeenAt?.toISOString() ?? null };
    }
  }
}
