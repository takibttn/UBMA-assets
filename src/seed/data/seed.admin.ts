import { eq } from 'drizzle-orm';
import { users } from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { ADMIN_EMAIL } from './types';

export async function seedAdmin(
  ctx: AcademicSeedContext,
): Promise<{ id: string }> {
  const { db, hashedPassword } = ctx;
  const email = ADMIN_EMAIL.toLowerCase();
  await db
    .insert(users)
    .values({
      firstName: 'CEIL',
      lastName: 'Administrator',
      email,
      password: hashedPassword,
      role: 'ADMIN',
      accountType: 'INTERNAL_STUDENT',
      bacYear: null,
      matricule: null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        firstName: 'CEIL',
        lastName: 'Administrator',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
  ctx.counters.adminUpserted += 1;

  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!row[0]) {
    throw new Error('Admin seed failed');
  }
  return row[0];
}
