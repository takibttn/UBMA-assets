import type { AcademicSeedContext } from './context';
import {
  firstLanguageLevelIds,
  seedClosedSaleFormation,
} from './seed.demo-academic-scenarios.part1';
import { seedCancelledCohort } from './seed.demo-academic-scenarios.part2';
import {
  seedAssistantTeacher,
  seedFormation01ExtraSessions,
  seedInternalStudent,
} from './seed.demo-academic-scenarios.part3';
import { seedWeeklyRoomDemo } from './seed.demo-academic-scenarios.part4';

/**
 * Extra academic demo data: closed sale, internal learner, mixed session statuses,
 * cancelled enrollment cohort, ASSISTANT teacher, **weekly room availability** sample
 * formation (`CEIL Academic Demo — Calendrier salle hebdo`) — idempotent, titles prefixed
 * `CEIL Academic Demo` (excluded from bulk certificate seed).
 */
export async function seedDemoAcademicScenarios(
  ctx: AcademicSeedContext,
  adminId: string,
  teachersOrdered: Array<{ id: string; email: string }>,
  mainFormationIds: string[],
): Promise<void> {
  if (teachersOrdered.length < 2) {
    throw new Error('Academic demo: need at least 2 teachers');
  }

  const { db } = ctx;
  const { languageId, levelId } = await firstLanguageLevelIds(db);
  const mainTeacherId = teachersOrdered[0].id;
  const assistantTeacherId = teachersOrdered[1].id;

  // ── Closed sale formation (L5 manual tests) ─────────────────────────────
  await seedClosedSaleFormation(
    ctx,
    adminId,
    languageId,
    levelId,
    mainTeacherId,
  );

  // ── Cancelled cohort formation + learner (cancelled enrollment row) ───
  await seedCancelledCohort(ctx, adminId, languageId, levelId, mainTeacherId);

  // ── Internal student (I1 — STUDENT login) ───────────────────────────────
  await seedInternalStudent(ctx);

  // ── ASSISTANT on main Formation 01 ─────────────────────────────────────
  await seedAssistantTeacher(
    ctx,
    adminId,
    assistantTeacherId,
    mainFormationIds[0],
  );

  // ── Extra sessions on Formation 01: CANCELLED + COMPLETED ───────────────
  await seedFormation01ExtraSessions(ctx, adminId, mainFormationIds[0]);

  // ── Weekly room availability demo (POST .../availability-for-weekly-slot) ──
  await seedWeeklyRoomDemo(ctx, adminId, languageId, levelId, mainTeacherId);
}
