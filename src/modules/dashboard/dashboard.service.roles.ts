import { AuthUser } from '@modules/auth/types/auth-user.type';
import { DashboardServiceAdmin } from './dashboard.service.admin';

export abstract class DashboardServiceRoles extends DashboardServiceAdmin {
  // ─── Teacher ──────────────────────────────────────────────────────────────

  async getTeacherDashboard(user: AuthUser) {
    const [stats, assignedFormations, upcomingAssignedFormations] =
      await Promise.all([
        this.dashboardRepository.getTeacherStats(user.id),
        this.dashboardRepository.getTeacherAssignedFormations(user.id),
        this.dashboardRepository.getUpcomingTeacherFormations(user.id),
      ]);

    return {
      ...stats,
      upcomingAssignedFormations,
      assignedFormations,
    };
  }

  // ─── Learner profile (APPRENANT) ─────────────────────────────────────────

  getLearnerProfileOverview(user: AuthUser) {
    return this.enrollmentsService.getLearnerProfileOverview(user);
  }

  // ─── Legacy learner dashboard ──────────────────────────────────────────────

  async getStudentDashboard(user: AuthUser) {
    const [stats, enrolledFormations, nextFormation] = await Promise.all([
      this.dashboardRepository.getStudentStats(user.id),
      this.dashboardRepository.getStudentEnrollments(user.id),
      this.dashboardRepository.getStudentNextFormation(user.id),
    ]);

    return {
      ...stats,
      enrolledFormations,
      nextFormation,
    };
  }
}
