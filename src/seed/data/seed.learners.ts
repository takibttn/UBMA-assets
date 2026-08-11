import { users } from '@/database/schema';
import type { AcademicSeedContext } from './context';

const studentToSeed = {
  email: 'student@email.com',
  firstName: 'Main',
  lastName: 'Student',
  dob: '1995-01-01',
};

export function buildExternalLearnerSeeds() {
  return Array.from({ length: 20 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      email: `student.${n}@email.com`,
      firstName: 'Student',
      lastName: `External${n}`,
      dob: `1995-${String((i % 12) + 1).padStart(2, '0')}-15`,
    };
  });
}

export async function seedExternalLearners(
  ctx: AcademicSeedContext,
): Promise<Array<{ id: string; email: string }>> {
  const { db, hashedPassword } = ctx;
  const seeds = buildExternalLearnerSeeds();
  const seedsToInsert = [studentToSeed, ...seeds];

  for (const row of seedsToInsert) {
    const email = row.email.toLowerCase();
    await db
      .insert(users)
      .values({
        firstName: row.firstName,
        lastName: row.lastName,
        email,
        bacYear: null,
        matricule: null,
        dob: row.dob,
        password: hashedPassword,
        role: 'APPRENANT',
        accountType: 'EXTERNAL_LEARNER',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: row.firstName,
          lastName: row.lastName,
          password: hashedPassword,
          dob: row.dob,
          role: 'APPRENANT',
          accountType: 'EXTERNAL_LEARNER',
        },
      });
    ctx.counters.learnersUpserted += 1;
  }

  const wantAcademic = new Set(seeds.map((s) => s.email.toLowerCase()));
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  return rows
    .filter((r): r is { id: string; email: string } =>
      Boolean(r.email && wantAcademic.has(r.email)),
    )
    .sort((a, b) => a.email.localeCompare(b.email));
}
