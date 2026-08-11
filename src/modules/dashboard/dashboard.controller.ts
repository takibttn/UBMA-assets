import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import { LearnerProfileOverviewResponseDto } from '@modules/enrollments/dto/learner-profile-overview.dto';
import { DashboardControllerBase } from './dashboard.controller.base';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController extends DashboardControllerBase {
  constructor(dashboardService: DashboardService) {
    super(dashboardService);
  }

  // ─── Teacher ──────────────────────────────────────────────────────────────

  @Get('teacher')
  @Auth(UserRole.ENSEIGNANT)
  @ApiOperation({
    summary: 'Teacher dashboard: assigned formations and enrollments',
  })
  @ApiOkResponse({ description: 'Teacher dashboard data' })
  getTeacherDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getTeacherDashboard(user);
  }

  // ─── Learner (APPRENANT) profile ─────────────────────────────────────────

  @Get('student/overview')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({
    summary:
      'Learner profile overview — ENROLLED-only stats, certificates count, next in-progress formation card',
  })
  @ApiOkResponse({ type: LearnerProfileOverviewResponseDto })
  getLearnerProfileOverview(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getLearnerProfileOverview(user);
  }

  // ─── Learner legacy dashboard ─────────────────────────────────────────────

  @Get('student')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({
    summary: '[Deprecated] Legacy learner dashboard — raw formations list',
    deprecated: true,
    description:
      'Prefer GET /dashboard/student/overview plus GET /enrollments/me/profile for the new learner experience.',
  })
  @ApiOkResponse({ description: 'Legacy student dashboard data' })
  getStudentDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getStudentDashboard(user);
  }
}
