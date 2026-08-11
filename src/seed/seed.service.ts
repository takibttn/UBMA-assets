import { Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { DATABASE } from '@/database/database.provider';
import type { Database } from '@/database/database.types';
import { ACADEMIC_SEED_PASSWORD } from '@/seed/data/types';
import type { SeedContext, SeedOptions } from './seed.types';
import {
  createAcademicSeedContext,
  type AcademicSeedContext,
} from '@/seed/data/context';
import { seedBulkFormationsAndEnrollments } from '@/seed/data/seed.bulk';
import { seedSameDayFormationsForExistingTeacher } from '@/seed/data/seed.same-day-formations';
import { seedFormationFeedbackForExistingEnrollments } from '@/seed/data/seed.formation-feedback';
import { seedLanguagesAndLevels } from '@/seed/data/seed.languages-levels';
import { seedAdmin } from '@/seed/data/seed.admin';
import { seedTeachers } from '@/seed/data/seed.teachers';
import { seedRooms } from '@/seed/data/seed.rooms';
import { seedFormationsAndAssignments } from '@/seed/data/seed.formations';
import { seedFormationSessions } from '@/seed/data/seed.formation-sessions';
import { seedExternalLearners } from '@/seed/data/seed.learners';
import { seedEnrollments } from '@/seed/data/seed.enrollments';
import { seedSessionAttendanceDemo } from '@/seed/data/seed.session-attendance';
import { seedCertificatesForActiveEnrollments } from '@/seed/data/seed.certificates';
import { seedDemoAcademicScenarios } from '@/seed/data/seed.demo-academic-scenarios';
import { seedPayments } from '@/seed/data/seed.payments';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async run(options: SeedOptions): Promise<void> {
    const seedContext: SeedContext = {};
    this.logger.log(`Running database seed with mode: ${options.mode}`);

    if (options.mode === 'bulk') {
      await this.runBulkSeed();
      return;
    }

    if (options.mode === 'same-day') {
      await this.runSameDaySeed();
      return;
    }

    if (options.mode === 'tracking-feedback') {
      await this.runTrackingFeedbackSeed();
      return;
    }

    await this.runDefaultSeed(seedContext);
  }

  private createAcademicSeedContext =
    async (): Promise<AcademicSeedContext> => {
      const hashedPassword = await bcrypt.hash(ACADEMIC_SEED_PASSWORD, 10);

      return createAcademicSeedContext(this.db, hashedPassword);
    };

  private async runDefaultSeed(context: SeedContext): Promise<void> {
    const ctx = await this.createAcademicSeedContext();

    await seedLanguagesAndLevels(ctx);

    const admin = await seedAdmin(ctx);
    const teachers = await seedTeachers(ctx);

    await seedRooms(ctx);

    const formationIds = await seedFormationsAndAssignments(
      ctx,
      admin.id,
      teachers,
    );
    await seedFormationSessions(ctx, admin.id, formationIds);

    const learners = await seedExternalLearners(ctx);
    await seedEnrollments(ctx, learners, formationIds);
    await seedSessionAttendanceDemo(ctx, formationIds);
    await seedCertificatesForActiveEnrollments(ctx);
    await seedDemoAcademicScenarios(ctx, admin.id, teachers, formationIds);
    await seedFormationFeedbackForExistingEnrollments(ctx);
    await seedPayments(ctx, formationIds);

    this.logger.log(
      `Default seed completed: ${JSON.stringify(context, null, 2)}`,
    );
  }

  private async runBulkSeed(): Promise<void> {
    const ctx = await this.createAcademicSeedContext();
    const formationCount = Number(process.env.BULK_FORMATION_COUNT ?? '50');
    const enrollmentRate = Number(process.env.BULK_ENROLLMENT_RATE ?? '0.9');
    await seedBulkFormationsAndEnrollments(ctx, formationCount, enrollmentRate);
    this.logger.log(
      `Bulk seed completed with count=${formationCount} enrollmentRate=${enrollmentRate}`,
    );
  }

  private async runSameDaySeed(): Promise<void> {
    const ctx = await this.createAcademicSeedContext();
    const teacherEmail =
      process.env.SAME_DAY_TEACHER_EMAIL ?? 'teacher.01@email.com';
    const slotCount = Math.min(
      24,
      Math.max(1, parseInt(process.env.SAME_DAY_SLOT_COUNT ?? '10', 10) || 10),
    );
    await seedSameDayFormationsForExistingTeacher(ctx, {
      teacherEmail,
      slotCount,
    });
    this.logger.log(
      `Same-day seed completed for ${teacherEmail} with ${slotCount} slots.`,
    );
  }

  private async runTrackingFeedbackSeed(): Promise<void> {
    const ctx = await this.createAcademicSeedContext();
    await seedFormationFeedbackForExistingEnrollments(ctx);
    this.logger.log('Tracking-feedback seed completed.');
  }
}
