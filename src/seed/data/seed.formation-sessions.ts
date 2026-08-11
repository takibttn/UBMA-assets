import { asc, count, eq } from 'drizzle-orm';
import { formationSessions, formations, rooms } from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { addDays } from './context';

function setUtcTime(d: Date, hour: number, minute: number): Date {
  const o = new Date(d);
  o.setUTCHours(hour, minute, 0, 0);
  return o;
}

/**
 * Picks ordered active rooms that can legally host the formation (`room.capacity >= formation.capacity`).
 * When formation has no capacity cap, any active room is allowed.
 */
async function eligibleRoomIdsForFormation(
  db: AcademicSeedContext['db'],
  formationCapacity: number | null,
): Promise<string[]> {
  const cap = formationCapacity ?? 0;
  const all = await db
    .select({ id: rooms.id, capacity: rooms.capacity, code: rooms.code })
    .from(rooms)
    .where(eq(rooms.isActive, true))
    .orderBy(asc(rooms.code));

  const eligible =
    formationCapacity === null || formationCapacity === undefined
      ? all
      : all.filter((r) => r.capacity >= cap);

  if (eligible.length === 0) {
    throw new Error(
      `No active room with capacity >= formation capacity (${formationCapacity}). Add rooms or lower formation capacity.`,
    );
  }

  return eligible.map((r) => r.id);
}

/**
 * Deterministic non-overlapping sessions inside each formation window; rooms rotate among **eligible** rooms only.
 * Skips formations that already have sessions (idempotent).
 */
export async function seedFormationSessions(
  ctx: AcademicSeedContext,
  adminUserId: string,
  formationIds: string[],
): Promise<void> {
  const { db } = ctx;

  for (let fi = 0; fi < formationIds.length; fi += 1) {
    const formationId = formationIds[fi];
    const [f] = await db
      .select({
        id: formations.id,
        title: formations.title,
        startDate: formations.startDate,
        endDate: formations.endDate,
        capacity: formations.capacity,
      })
      .from(formations)
      .where(eq(formations.id, formationId))
      .limit(1);

    if (!f?.startDate || !f.endDate) {
      continue;
    }

    const [cnt] = await db
      .select({ n: count() })
      .from(formationSessions)
      .where(eq(formationSessions.formationId, formationId));

    if (Number(cnt?.n ?? 0) > 0) {
      continue;
    }

    const roomIds = await eligibleRoomIdsForFormation(db, f.capacity);

    const dayOffsets = [0, 3, 7, 10];
    const slots: Array<{ startH: number; endH: number }> = [
      { startH: 9, endH: 11 },
      { startH: 14, endH: 16 },
      { startH: 9, endH: 11 },
      { startH: 14, endH: 15 },
    ];

    for (let s = 0; s < dayOffsets.length; s += 1) {
      const dayBase = addDays(f.startDate, dayOffsets[s]);
      const slot = slots[s] ?? slots[0];
      const startAt = setUtcTime(dayBase, slot.startH, 0);
      const endAt = setUtcTime(dayBase, slot.endH, 0);
      if (!(startAt < endAt)) {
        continue;
      }
      if (startAt < f.startDate || endAt > f.endDate) {
        continue;
      }

      const roomId = roomIds[(fi + s) % roomIds.length];
      const title =
        s === 0 ? `${f.title} - Séance` : `${f.title} - Séance ${s + 1}`;

      await db.insert(formationSessions).values({
        formationId: f.id,
        roomId,
        title,
        description: 'Academic seed session',
        startAt,
        endAt,
        status: 'SCHEDULED',
        createdById: adminUserId,
      });
      ctx.counters.formationSessionsInserted += 1;
    }
  }
}
