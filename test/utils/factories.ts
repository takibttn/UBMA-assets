import * as bcrypt from 'bcrypt';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { DEFAULT_PASSWORD, FORMATION_END, FORMATION_START } from './constants';

let suffixSeq = 0;
export function uniqueKey(): string {
  suffixSeq += 1;
  return `${Date.now()}-${suffixSeq}`;
}

export async function insertAdminUser(
  db: DrizzleDB,
  email?: string,
): Promise<typeof schema.users.$inferSelect> {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const em = (email ?? `admin-${uniqueKey()}@test.local`).toLowerCase();
  const [row] = await db
    .insert(schema.users)
    .values({
      firstName: 'Admin',
      lastName: 'Test',
      email: em,
      password: hash,
      role: 'ADMIN',
      accountType: 'INTERNAL_STUDENT',
      matricule: null,
      bacYear: null,
    })
    .returning();
  return row;
}

export async function insertLearnerUser(
  db: DrizzleDB,
  email?: string,
): Promise<typeof schema.users.$inferSelect> {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const em = (email ?? `learner-${uniqueKey()}@test.local`).toLowerCase();
  const [row] = await db
    .insert(schema.users)
    .values({
      firstName: 'Learner',
      lastName: 'Test',
      email: em,
      password: hash,
      role: 'APPRENANT',
      accountType: 'EXTERNAL_LEARNER',
      matricule: null,
      bacYear: null,
    })
    .returning();
  return row;
}

export async function insertTeacher(
  db: DrizzleDB,
  email?: string,
): Promise<typeof schema.teachers.$inferSelect> {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const em = (email ?? `teacher-${uniqueKey()}@test.local`).toLowerCase();
  const [row] = await db
    .insert(schema.teachers)
    .values({
      firstName: 'Teacher',
      lastName: 'Test',
      email: em,
      password: hash,
    })
    .returning();
  return row;
}

export async function insertLanguage(
  db: DrizzleDB,
  code?: string,
): Promise<typeof schema.languages.$inferSelect> {
  const c = (code ?? `L-${uniqueKey().slice(-8)}`).toUpperCase().slice(0, 20);
  const [row] = await db
    .insert(schema.languages)
    .values({
      name: `Language ${c}`,
      code: c,
      isActive: true,
    })
    .returning();
  return row;
}

export async function insertLevel(
  db: DrizzleDB,
  languageId: string,
  code?: string,
): Promise<typeof schema.formationLevels.$inferSelect> {
  const c = (code ?? `LV-${uniqueKey().slice(-6)}`).toUpperCase().slice(0, 10);
  const [row] = await db
    .insert(schema.formationLevels)
    .values({
      languageId,
      code: c,
      name: `Level ${c}`,
      order: 1,
      isActive: true,
    })
    .returning();
  return row;
}

export type FormationSeeds = {
  language: typeof schema.languages.$inferSelect;
  level: typeof schema.formationLevels.$inferSelect;
  formation: typeof schema.formations.$inferSelect;
};

export async function insertFormationWithRefs(
  db: DrizzleDB,
  opts: {
    title?: string;
    capacity?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    isSaleOpen?: boolean;
    price?: string;
  } = {},
): Promise<FormationSeeds> {
  const language = await insertLanguage(db);
  const level = await insertLevel(db, language.id);
  const [formation] = await db
    .insert(schema.formations)
    .values({
      title: opts.title ?? `Formation ${uniqueKey()}`,
      languageId: language.id,
      levelId: level.id,
      capacity: opts.capacity ?? 30,
      startDate: opts.startDate ?? new Date(FORMATION_START),
      endDate: opts.endDate ?? new Date(FORMATION_END),
      isSaleOpen: opts.isSaleOpen ?? true,
      ...(opts.price !== undefined ? { price: opts.price } : {}),
    })
    .returning();
  return { language, level, formation: formation };
}

export async function insertRoom(
  db: DrizzleDB,
  code?: string,
  capacity = 40,
  isActive = true,
): Promise<typeof schema.rooms.$inferSelect> {
  const c = (code ?? `SALLE-${uniqueKey().slice(-6)}`)
    .toUpperCase()
    .slice(0, 50);
  const [row] = await db
    .insert(schema.rooms)
    .values({
      code: c,
      name: `Room ${c}`,
      capacity,
      isActive,
    })
    .returning();
  return row;
}

export async function assignTeacherToFormation(
  db: DrizzleDB,
  formationId: string,
  teacherId: string,
  assignedById?: string | null,
): Promise<void> {
  await db.insert(schema.formationTeachers).values({
    formationId,
    teacherId,
    role: 'MAIN_TEACHER',
    assignedById: assignedById ?? null,
  });
}

export async function insertEnrollment(
  db: DrizzleDB,
  studentId: string,
  formationId: string,
  status: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT' = 'ENROLLED',
): Promise<typeof schema.enrollments.$inferSelect> {
  const [row] = await db
    .insert(schema.enrollments)
    .values({
      studentId,
      formationId,
      status,
    })
    .returning();
  return row;
}

export async function insertSession(
  db: DrizzleDB,
  opts: {
    formationId: string;
    roomId: string;
    startAt: Date;
    endAt: Date;
    title?: string;
    status?: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
    createdById?: string | null;
  },
): Promise<typeof schema.formationSessions.$inferSelect> {
  const [row] = await db
    .insert(schema.formationSessions)
    .values({
      formationId: opts.formationId,
      roomId: opts.roomId,
      startAt: opts.startAt,
      endAt: opts.endAt,
      title: opts.title ?? 'Séance',
      status: opts.status ?? 'SCHEDULED',
      createdById: opts.createdById ?? null,
    })
    .returning();
  return row;
}

export async function patchFormationDates(
  db: DrizzleDB,
  formationId: string,
  startDate: Date | null,
  endDate: Date | null,
): Promise<void> {
  await db
    .update(schema.formations)
    .set({ startDate, endDate })
    .where(eq(schema.formations.id, formationId));
}

export async function countAttendanceRows(
  db: DrizzleDB,
  sessionId: string,
): Promise<number> {
  const rows = await db
    .select()
    .from(schema.sessionAttendance)
    .where(eq(schema.sessionAttendance.sessionId, sessionId));
  return rows.length;
}

export async function findAttendanceByEnrollment(
  db: DrizzleDB,
  sessionId: string,
  enrollmentId: string,
) {
  const [r] = await db
    .select()
    .from(schema.sessionAttendance)
    .where(
      and(
        eq(schema.sessionAttendance.sessionId, sessionId),
        eq(schema.sessionAttendance.enrollmentId, enrollmentId),
      ),
    )
    .limit(1);
  return r;
}
