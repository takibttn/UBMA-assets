import { Inject } from '@nestjs/common';
import { DashboardRepository } from '@lib/repositories/dashboard/dashboard.repository';
import { EnrollmentsService } from '@modules/enrollments/enrollments.service';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';
import { AdminDashboardStatsDto } from './dto/admin-dashboard-stats.dto';
import {
  FormationCapacityTrackingItemDto,
  FormationCapacityStatus,
} from './dto/formation-capacity-tracking-item.dto';
import {
  FormationDeadlineTrackingItemDto,
  FormationDeadlineStatus,
} from './dto/formation-deadline-tracking-item.dto';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export abstract class DashboardServiceBase {
  protected readonly dashboardRepository: DashboardRepository;
  protected readonly enrollmentsService: EnrollmentsService;
  protected readonly formationFeedbackRepository: FormationFeedbackRepository;
  protected readonly formationTrackingRepository: FormationTrackingRepository;

  constructor(
    @Inject(DashboardRepository) dashboardRepository: DashboardRepository,
    @Inject(EnrollmentsService) enrollmentsService: EnrollmentsService,
    @Inject(FormationFeedbackRepository)
    formationFeedbackRepository: FormationFeedbackRepository,
    @Inject(FormationTrackingRepository)
    formationTrackingRepository: FormationTrackingRepository,
  ) {
    this.dashboardRepository = dashboardRepository;
    this.enrollmentsService = enrollmentsService;
    this.formationFeedbackRepository = formationFeedbackRepository;
    this.formationTrackingRepository = formationTrackingRepository;
  }

  // ─── Legacy admin (kept for backward-compat with GET /dashboard/admin) ────

  async getAdminDashboard() {
    const [stats, recentEnrollments] = await Promise.all([
      this.dashboardRepository.getAdminStats(),
      this.dashboardRepository.getRecentEnrollments(5),
    ]);

    return {
      ...stats,
      recentEnrollments,
      formationsByStatus: {
        open: stats.openFormations,
        closed: stats.closedFormations,
      },
    };
  }

  // ─── New admin stats ───────────────────────────────────────────────────────

  async getAdminDashboardStats(): Promise<AdminDashboardStatsDto> {
    return this.dashboardRepository.getNewAdminStats();
  }

  // ─── Formation capacity tracking ──────────────────────────────────────────

  async getFormationCapacityTracking(params: {
    limit: number;
    minOccupancyRate: number;
  }): Promise<FormationCapacityTrackingItemDto[]> {
    const rows = await this.dashboardRepository.getFormationCapacityTracking();

    const items = rows.map((row) => {
      const occupancyRate = Math.round(
        (row.enrolledCount / row.capacity) * 100,
      );

      let status: FormationCapacityStatus;
      if (row.enrolledCount >= row.capacity) {
        status = 'FULL';
      } else if (occupancyRate >= 85) {
        status = 'ALMOST_FULL';
      } else if (row.isSaleOpen) {
        status = 'OPEN';
      } else {
        status = 'CLOSED';
      }

      return {
        formationId: row.formationId,
        title: row.title,
        languageCode: row.languageCode,
        languageName: row.languageName,
        levelCode: row.levelCode,
        levelName: row.levelName,
        capacity: row.capacity,
        enrolledCount: row.enrolledCount,
        occupancyRate,
        status,
      };
    });

    return items
      .filter((item) => item.occupancyRate >= params.minOccupancyRate)
      .sort((a, b) => b.occupancyRate - a.occupancyRate)
      .slice(0, params.limit);
  }

  // ─── Formation deadline tracking ──────────────────────────────────────────

  async getFormationDeadlineTracking(params: {
    limit: number;
    withinDays: number;
  }): Promise<FormationDeadlineTrackingItemDto[]> {
    const rows = await this.dashboardRepository.getFormationDeadlineTracking();
    const now = new Date();

    const items = rows.map((row) => {
      const endDate = row.endDate;
      const daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / MS_PER_DAY,
      );

      let status: FormationDeadlineStatus;
      if (endDate < now) {
        status = 'ENDED';
      } else if (row.startDate && row.startDate > now) {
        status = 'UPCOMING';
      } else if (daysRemaining >= 0 && daysRemaining <= 30) {
        status = 'ENDING_SOON';
      } else {
        status = 'ACTIVE';
      }

      return {
        formationId: row.formationId,
        title: row.title,
        languageCode: row.languageCode,
        languageName: row.languageName,
        levelCode: row.levelCode,
        levelName: row.levelName,
        startDate: row.startDate ? row.startDate.toISOString() : null,
        endDate: endDate.toISOString(),
        daysRemaining,
        enrolledCount: row.enrolledCount,
        status,
      };
    });

    const filtered = items.filter(
      (item) =>
        item.status === 'ENDED' ||
        (item.daysRemaining !== null &&
          item.daysRemaining <= params.withinDays),
    );

    return filtered.slice(0, params.limit);
  }
}
