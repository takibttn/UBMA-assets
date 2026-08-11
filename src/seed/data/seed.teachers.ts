import { teachers } from '@/database/schema';
import type { AcademicSeedContext } from './context';

/** Ten teachers · emails `teacher.01@email.com` … `teacher.10@email.com` */
export function buildTeacherSeeds() {
  return Array.from({ length: 10 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      email: `teacher.${n}@email.com`,
      firstName: 'Teacher',
      lastName: `Seed${n}`,
    };
  });
}

const teacherToSeed = {
  email: 'teacher@email.com',
  firstName: 'Main',
  lastName: 'Teacher',
};
export async function seedTeachers(
  ctx: AcademicSeedContext,
): Promise<Array<{ id: string; email: string }>> {
  const { db, hashedPassword } = ctx;
  const seeds = buildTeacherSeeds();
  const seedsToInsert = [teacherToSeed, ...seeds];

  for (const t of seedsToInsert) {
    const email = t.email.toLowerCase();
    await db
      .insert(teachers)
      .values({
        firstName: t.firstName,
        lastName: t.lastName,
        email,
        password: hashedPassword,
      })
      .onConflictDoUpdate({
        target: teachers.email,
        set: {
          firstName: t.firstName,
          lastName: t.lastName,
          password: hashedPassword,
        },
      });
    ctx.counters.teachersUpserted += 1;
  }

  const emails = seedsToInsert.map((s) => s.email.toLowerCase());
  const rows = await db
    .select({ id: teachers.id, email: teachers.email })
    .from(teachers);
  return rows
    .filter((r) => emails.includes(r.email))
    .sort((a, b) => a.email.localeCompare(b.email));
}
