import { eq } from 'drizzle-orm';
import { rooms } from '@/database/schema';
import type { AcademicSeedContext } from './context';

const ROOM_SPECS = [
  { code: 'SALLE-01', name: 'Salle 01', capacity: 25 },
  { code: 'SALLE-02', name: 'Salle 02', capacity: 25 },
  { code: 'SALLE-03', name: 'Salle 03', capacity: 30 },
  { code: 'LAB-01', name: 'Laboratoire 01', capacity: 20 },
  /**
   * Active but smaller than main academic formations (capacity 20) —
   * `POST /rooms/availability-for-weekly-slot` returns INSUFFICIENT_CAPACITY.
   */
  {
    code: 'SALLE-PETITE',
    name: 'Petite salle (cap. < formation)',
    capacity: 18,
  },
  /** Inactive — admin demos (list filter, inactive status on availability). */
  {
    code: 'SALLE-MAINT',
    name: 'Salle maintenance (inactive)',
    capacity: 25,
    isActive: false as const,
  },
] as const;

export async function seedRooms(ctx: AcademicSeedContext): Promise<string[]> {
  const { db } = ctx;
  const ids: string[] = [];

  for (const spec of ROOM_SPECS) {
    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, spec.code))
      .limit(1);

    if (existing[0]) {
      ids.push(existing[0].id);
      continue;
    }

    const inserted = await db
      .insert(rooms)
      .values({
        code: spec.code,
        name: spec.name,
        capacity: spec.capacity,
        isActive: 'isActive' in spec ? spec.isActive : true,
      })
      .returning({ id: rooms.id });

    ids.push(inserted[0].id);
    ctx.counters.roomsInserted += 1;
  }

  return ids;
}
