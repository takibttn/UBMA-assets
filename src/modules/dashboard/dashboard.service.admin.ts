import { AdminAlertDto } from './dto/admin-alert.dto';
import { TopFormationDto } from './dto/top-formation.dto';
import { TopLearnerDto } from './dto/top-learner.dto';
import { TopTeacherDto } from './dto/top-teacher.dto';
import { DashboardServiceBase } from './dashboard.service.base';

export abstract class DashboardServiceAdmin extends DashboardServiceBase {
  // ─── Admin alerts ─────────────────────────────────────────────────────────

  /**
   * Returns active admin alerts.
   * INCOMPLETE_PAYMENTS count is a temporary mock until a payments module exists.
   */
  async getAdminAlerts(): Promise<AdminAlertDto[]> {
    const [pendingEnrollments, certificatesToGenerate] = await Promise.all([
      this.dashboardRepository.getPendingEnrollmentsCount(),
      this.dashboardRepository.getCertificatesToGenerateCount(),
    ]);

    const incompletePayments = this.getMockIncompletePaymentsCount();

    const alerts: AdminAlertDto[] = [];

    alerts.push({
      id: 'pending-enrollments',
      type: 'PENDING_ENROLLMENTS',
      severity: pendingEnrollments > 0 ? 'URGENT' : 'WATCH',
      title: 'Pending Enrollments',
      description:
        pendingEnrollments > 0
          ? `${pendingEnrollments} enrollment(s) are awaiting validation.`
          : 'No enrollments pending validation.',
      count: pendingEnrollments,
      actionLabel: 'View Enrollments',
      actionHref: '/admin/enrollments?status=PENDING',
    });

    alerts.push({
      id: 'incomplete-payments',
      type: 'INCOMPLETE_PAYMENTS',
      severity: incompletePayments > 0 ? 'IMPORTANT' : 'WATCH',
      title: 'Incomplete Payments',
      description:
        incompletePayments > 0
          ? `${incompletePayments} payment(s) require attention.`
          : 'No incomplete payments.',
      count: incompletePayments,
      actionLabel: 'View Payments',
      actionHref: '/admin/payments?status=INCOMPLETE',
    });

    alerts.push({
      id: 'certificates-to-generate',
      type: 'CERTIFICATES_TO_GENERATE',
      severity: certificatesToGenerate > 0 ? 'IMPORTANT' : 'WATCH',
      title: 'Certificates to Generate',
      description:
        certificatesToGenerate > 0
          ? `${certificatesToGenerate} certificate(s) are ready to be generated.`
          : 'No certificates pending generation.',
      count: certificatesToGenerate,
      actionLabel: 'Generate Certificates',
      actionHref: '/admin/certificates?pending=true',
    });

    return alerts.filter((alert) => alert.count > 0);
  }

  /**
   * Temporary mock until a payments module is integrated.
   * Replace the return value with a real DB query once payment tracking is available.
   */
  private getMockIncompletePaymentsCount(): number {
    // TODO: replace with real payments repository query once the payments module exists
    return 4;
  }

  // ─── Top formations ───────────────────────────────────────────────────────

  async getTopFormations(params: {
    limit: number;
  }): Promise<TopFormationDto[]> {
    const rows = await this.dashboardRepository.getTopFormations(params);
    const ids = rows.map((r) => r.formationId);
    const now = new Date();
    const [fbMap, metricsMap] = await Promise.all([
      this.formationFeedbackRepository.getAggregatesForFormations(ids),
      this.formationTrackingRepository.getDashboardMetricsForFormations(
        ids,
        now,
      ),
    ]);

    return rows.map((row) => {
      const fb = fbMap.get(row.formationId);
      const m = metricsMap.get(row.formationId);
      const capacity = row.capacity;
      const enrolledCount = row.enrolledCount;
      const occupancyRate =
        capacity != null && capacity > 0
          ? Math.min(100, Math.round((enrolledCount / capacity) * 100))
          : null;
      return {
        formationId: row.formationId,
        title: row.title,
        price: row.price != null ? String(row.price) : null,
        capacity,
        occupancyRate,
        languageCode: row.languageCode,
        languageName: row.languageName,
        levelCode: row.levelCode,
        levelName: row.levelName,
        enrolledCount: row.enrolledCount,
        certificateCount: row.certificateCount,
        successRate:
          row.enrolledCount > 0
            ? Math.round((row.certificateCount / row.enrolledCount) * 100)
            : 0,
        averageRating: fb?.averageRating ?? null,
        ratingCount: fb?.ratingCount ?? 0,
        averageAttendanceRate: m?.averageAttendanceRate ?? 0,
        totalSessionsCount: m?.totalSessionsCount ?? 0,
        certificateReadyCount: m?.certificateReadyCount ?? 0,
      };
    });
  }

  /**
   * Top learners by attendance and completion — not academic performance / grades.
   */
  async getTopLearners(params: { limit: number }): Promise<TopLearnerDto[]> {
    return this.dashboardRepository.getTopLearners(params);
  }

  // ─── Top teachers ─────────────────────────────────────────────────────────

  async getTopTeachers(params: { limit: number }): Promise<TopTeacherDto[]> {
    const rows = await this.dashboardRepository.getTopTeachers(params);

    return rows.map((row) => ({
      teacherId: row.teacherId,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`,
      formationsCount: row.formationsCount,
      studentsCount: row.studentsCount,
    }));
  }
}
