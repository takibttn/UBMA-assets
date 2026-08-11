import { Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Auth } from '@lib/decorators/auth.decorator';
import { UserRole } from '@modules/auth/types/user-role.type';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { AdminDashboardStatsDto } from './dto/admin-dashboard-stats.dto';
import { FormationCapacityTrackingItemDto } from './dto/formation-capacity-tracking-item.dto';
import { FormationDeadlineTrackingItemDto } from './dto/formation-deadline-tracking-item.dto';
import { AdminAlertDto } from './dto/admin-alert.dto';
import { TopFormationDto } from './dto/top-formation.dto';
import { TopLearnerDto } from './dto/top-learner.dto';
import { TopTeacherDto } from './dto/top-teacher.dto';

export abstract class DashboardControllerBase {
  constructor(protected readonly dashboardService: DashboardService) {}

  // ─── Legacy admin overview (kept for backward-compat) ────────────────────

  @Get('admin')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: '[Legacy] Admin dashboard — single response with all stats',
    deprecated: true,
  })
  @ApiOkResponse({ description: 'Aggregated admin dashboard data' })
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  // ─── New focused admin endpoints ──────────────────────────────────────────

  @Get('admin/stats')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin dashboard stats cards' })
  @ApiOkResponse({ type: AdminDashboardStatsDto })
  getAdminStats(): Promise<AdminDashboardStatsDto> {
    return this.dashboardService.getAdminDashboardStats();
  }

  @Get('admin/formation-tracking/by-capacity')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Formations ranked by occupancy rate (approaching capacity)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max records (1-50, default 5)',
  })
  @ApiQuery({
    name: 'minOccupancyRate',
    required: false,
    type: Number,
    description: 'Minimum occupancy % to include (0-100, default 70)',
  })
  @ApiOkResponse({ type: [FormationCapacityTrackingItemDto] })
  getFormationTrackingByCapacity(
    @Query() query: DashboardQueryDto,
  ): Promise<FormationCapacityTrackingItemDto[]> {
    return this.dashboardService.getFormationCapacityTracking({
      limit: query.limit ?? 5,
      minOccupancyRate: query.minOccupancyRate ?? 70,
    });
  }

  @Get('admin/formation-tracking/by-deadline')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Formations closest to their end date',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max records (1-50, default 5)',
  })
  @ApiQuery({
    name: 'withinDays',
    required: false,
    type: Number,
    description: 'Include formations ending within N days (1-365, default 30)',
  })
  @ApiOkResponse({ type: [FormationDeadlineTrackingItemDto] })
  getFormationTrackingByDeadline(
    @Query() query: DashboardQueryDto,
  ): Promise<FormationDeadlineTrackingItemDto[]> {
    return this.dashboardService.getFormationDeadlineTracking({
      limit: query.limit ?? 5,
      withinDays: query.withinDays ?? 30,
    });
  }

  @Get('admin/alerts')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Admin priority alerts (pending enrollments, payments, certificates)',
  })
  @ApiOkResponse({ type: [AdminAlertDto] })
  getAdminAlerts(): Promise<AdminAlertDto[]> {
    return this.dashboardService.getAdminAlerts();
  }

  @Get('admin/top-formations')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Top formations ranked by enrollment and success rate (includes ratings and attendance metrics)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max records (1-50, default 5)',
  })
  @ApiOkResponse({ type: [TopFormationDto] })
  getTopFormations(
    @Query() query: DashboardQueryDto,
  ): Promise<TopFormationDto[]> {
    return this.dashboardService.getTopFormations({ limit: query.limit ?? 5 });
  }

  @Get('admin/top-teachers')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Top teachers ranked by formations and student count',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max records (1-50, default 5)',
  })
  @ApiOkResponse({ type: [TopTeacherDto] })
  getTopTeachers(@Query() query: DashboardQueryDto): Promise<TopTeacherDto[]> {
    return this.dashboardService.getTopTeachers({ limit: query.limit ?? 5 });
  }

  @Get('admin/top-learners')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Top learners by average attendance and formation completion (not grades)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max records (1-50, default 5)',
  })
  @ApiOkResponse({ type: [TopLearnerDto] })
  getTopLearners(@Query() query: DashboardQueryDto): Promise<TopLearnerDto[]> {
    return this.dashboardService.getTopLearners({ limit: query.limit ?? 5 });
  }
}
