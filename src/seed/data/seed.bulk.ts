import { eq } from 'drizzle-orm';
import {
  formations,
  users,
  teachers,
  formationTeachers,
  formationLevels,
  enrollments,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';

export async function seedBulkFormationsAndEnrollments(
  ctx: AcademicSeedContext,
  count: number = 50,
  enrollmentRate: number = 0.9,
): Promise<void> {
  const { db } = ctx;

  // 1. Get existing data pool
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'APPRENANT'));

  const allTeachers = await db.select({ id: teachers.id }).from(teachers);

  const combos = await db
    .select({
      languageId: formationLevels.languageId,
      levelId: formationLevels.id,
    })
    .from(formationLevels)
    .where(eq(formationLevels.isActive, true));

  if (
    allUsers.length === 0 ||
    allTeachers.length === 0 ||
    combos.length === 0
  ) {
    throw new Error(
      'Required base data (users, teachers, levels) missing. Run npm run db:seed first.',
    );
  }

  const adminRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'admin@email.com'))
    .limit(1);
  const adminId = adminRow[0]?.id;

  console.log(
    `Starting bulk seed: ${count} formations, ~${enrollmentRate * 100}% enrollment rate.`,
  );

  const now = new Date();

  for (let i = 0; i < count; i++) {
    const combo = combos[Math.floor(Math.random() * combos.length)];
    const teacher = allTeachers[Math.floor(Math.random() * allTeachers.length)];

    const startDate = new Date(now);
    startDate.setDate(now.getDate() + Math.floor(Math.random() * 60) - 30); // Random date +/- 30 days
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30);

    const title = `Bulk Formation ${String(i + 1).padStart(3, '0')}`;

    // Create Formation
    const [formation] = await db
      .insert(formations)
      .values({
        title,
        description: `Bulk generated formation for testing performance and scale.`,
        languageId: combo.languageId,
        levelId: combo.levelId,
        creatorId: adminId,
        price: (Math.floor(Math.random() * 5000) + 1000).toString(),
        capacity: 20,
        isSaleOpen: true,
        startDate,
        endDate,
      })
      .onConflictDoNothing()
      .returning({ id: formations.id });

    if (!formation) continue;
    ctx.counters.formationsInserted += 1;

    // Assign Teacher
    await db.insert(formationTeachers).values({
      formationId: formation.id,
      teacherId: teacher.id,
      assignedById: adminId,
      role: 'MAIN_TEACHER',
    });
    ctx.counters.formationTeachersInserted += 1;

    // Enroll Users (90% chance)
    if (Math.random() < enrollmentRate) {
      // Pick a random number of students for this formation
      // To ensure some formations show up in tracking (minOccupancyRate=70),
      // we make the first 10% of formations 'hot' (15-20 students).
      const isHot = i < count * 0.1;
      const studentCount = isHot
        ? Math.floor(Math.random() * 6) + 15 // 15 to 20
        : Math.floor(Math.random() * 5) + 1; // 1 to 5

      const shuffledUsers = [...allUsers].sort(() => 0.5 - Math.random());
      const selectedUsers = shuffledUsers.slice(0, studentCount);

      for (const student of selectedUsers) {
        await db
          .insert(enrollments)
          .values({
            studentId: student.id,
            formationId: formation.id,
            status: 'ENROLLED',
          })
          .onConflictDoNothing();
        ctx.counters.enrollmentsInserted += 1;
      }
    }
  }

  console.log('Bulk seed completed.');
}
