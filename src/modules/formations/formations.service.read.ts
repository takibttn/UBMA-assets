import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { buildLearnerFormationAvailability } from '@lib/formations/formation-base.mapper';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import {
  AdminFormationAnalyticsDto,
  FormationAnalyticsStatus,
} from './dto/admin-formation-analytics.dto';
import { AdminFormationStatsDto } from './dto/admin-formation-stats.dto';
import { FindFormationsQueryDto } from './dto/find-formations-query.dto';
import { FormationsServiceBase } from './formations.service.base';

export abstract class FormationsReadService extends FormationsServiceBase {
  async getAllFormations(query: FindFormationsQueryDto, user?: AuthUser) {
    const page = await this.formationsRepository.findAllPaginated(query);
    const enrollMap =
      user?.role === UserRole.APPRENANT
        ? await this.enrollmentsRepository.findEnrollmentsForStudentForFormations(
            user.id,
            page.data.map((r) => r.id),
          )
        : null;

    return {
      ...page,
      data: page.data.map((row) => {
        const base = this.mapFormationListOrDetailRow({
          ...row,
          enrolledCount: row.enrolledCount,
        });
        if (!user || user.role !== UserRole.APPRENANT) {
          return base;
        }
        const en = enrollMap?.get(row.id);
        const avail = buildLearnerFormationAvailability({
          myEnrollmentRow: en ?? null,
          isSaleOpen: row.isSaleOpen,
          capacity: row.capacity,
          reservedCount: Number(row.reservedCount ?? 0),
        });
        return { ...base, ...avail };
      }),
    };
  }

  async getFormationById(id: string, viewer?: AuthUser) {
    const formation =
      await this.formationsRepository.findByIdWithLanguageAndLevel(id);
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }
    const base = this.mapFormationListOrDetailRow({
      id: formation.id,
      title: formation.title,
      description: formation.description,
      creatorId: formation.creatorId,
      languageId: formation.languageId,
      levelId: formation.levelId,
      price: formation.price,
      capacity: formation.capacity,
      isSaleOpen: formation.isSaleOpen,
      startDate: formation.startDate,
      endDate: formation.endDate,
      createdAt: formation.createdAt,
      enrolledCount: formation.enrolledCount,
      reservedCount: formation.reservedCount,
      language: formation.language,
      level: formation.level,
      assignedTeacherId: formation.assignedTeacherId,
      assignedTeacherFirstName: formation.assignedTeacherFirstName,
      assignedTeacherLastName: formation.assignedTeacherLastName,
      assignedTeacherEmail: formation.assignedTeacherEmail,
    });
    if (!viewer || viewer.role !== UserRole.APPRENANT) {
      return base;
    }
    const en = await this.enrollmentsRepository.findByStudentAndFormation(
      viewer.id,
      id,
    );
    const avail = buildLearnerFormationAvailability({
      myEnrollmentRow: en ?? null,
      isSaleOpen: formation.isSaleOpen,
      capacity: formation.capacity,
      reservedCount: Number(formation.reservedCount ?? 0),
    });
    return { ...base, ...avail };
  }

  // ─── Admin analytics ──────────────────────────────────────────────────────

  async getAdminStats(): Promise<AdminFormationStatsDto> {
    return this.formationsRepository.getAdminStats();
  }

  /**
   * Builds the admin analytics payload for the chart card.
   *
   * byStatus is computed in JS using a strict priority so each formation is
   * counted exactly once:
   *   1. ENDED     — endDate < now
   *   2. UPCOMING  — startDate > now
   *   3. CLOSED    — isSaleOpen = false
   *   4. OPEN      — otherwise
   */
  async getAdminAnalytics(): Promise<AdminFormationAnalyticsDto> {
    const [statusRows, byLanguage, byLevel] = await Promise.all([
      this.formationsRepository.getFormationsForStatusAnalytics(),
      this.formationsRepository.getFormationsByLanguage(),
      this.formationsRepository.getFormationsByLevel(),
    ]);

    const now = new Date();
    const counters: Record<FormationAnalyticsStatus, number> = {
      ENDED: 0,
      UPCOMING: 0,
      CLOSED: 0,
      OPEN: 0,
    };

    for (const row of statusRows) {
      counters[this.classifyFormationStatus(row, now)] += 1;
    }

    const byStatus: AdminFormationAnalyticsDto['byStatus'] = (
      ['OPEN', 'CLOSED', 'UPCOMING', 'ENDED'] as FormationAnalyticsStatus[]
    ).map((status) => ({ status, count: counters[status] }));

    return { byStatus, byLanguage, byLevel };
  }

  async getFormationTrackingAnalytics(formationId: string, user: AuthUser) {
    const exists = await this.formationsRepository.findById(formationId);
    if (!exists) {
      throw new NotFoundException('Formation not found');
    }

    if (user.role === UserRole.ADMIN) {
      return this.formationTrackingRepository.getFormationTrackingAnalytics(
        formationId,
      );
    }

    if (user.role === UserRole.ENSEIGNANT) {
      const ok = await this.teachersRepository.isTeacherAssignedToFormation(
        user.id,
        formationId,
      );
      if (!ok) {
        throw new ForbiddenException('Not assigned to this formation');
      }
      return this.formationTrackingRepository.getFormationTrackingAnalytics(
        formationId,
      );
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
