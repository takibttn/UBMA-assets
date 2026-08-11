import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import { FindTeacherCalendarQueryDto } from './dto/find-teacher-calendar-query.dto';
import { FindTeacherFormationSessionsQueryDto } from './dto/find-teacher-formation-sessions-query.dto';
import { FindTeacherFormationsQueryDto } from './dto/find-teacher-formations-query.dto';
import { TeacherFormationAccessGuard } from './guards/teacher-formation-access.guard';
import { TeachersService } from './teachers.service';
import { TeacherFormationTrackingService } from './teacher-formation-tracking.service';
import { SessionAttendanceService } from './session-attendance.service';
import { UpdateSessionAttendanceDto } from './dto/update-session-attendance.dto';

@ApiTags('teachers')
@Controller('teachers')
@Auth(UserRole.ENSEIGNANT)
export class TeachersMeController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly teacherFormationTrackingService: TeacherFormationTrackingService,
    private readonly sessionAttendanceService: SessionAttendanceService,
  ) {}

  @Get('me/formations')
  @ApiOperation({ summary: 'Get my formations (ENSEIGNANT only)' })
  getMyFormations(
    @CurrentUser() user: AuthUser,
    @Query() query: FindTeacherFormationsQueryDto,
  ) {
    return this.teachersService.getTeacherFormations(user.id, query);
  }

  @Get('me/formations/:formationId')
  @UseGuards(TeacherFormationAccessGuard)
  @ApiOperation({ summary: 'Get my formation details (ENSEIGNANT only)' })
  getMyFormationById(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
  ) {
    return this.teachersService.getTeacherFormationDetails(
      user.id,
      formationId,
    );
  }

  @Get('me/calendar')
  @ApiOperation({
    summary: 'Get my calendar (séances / SESSION) (ENSEIGNANT only)',
  })
  getMyCalendar(
    @CurrentUser() user: AuthUser,
    @Query() query: FindTeacherCalendarQueryDto,
  ) {
    return this.teachersService.getTeacherCalendar(user.id, query);
  }

  @Get('me/sessions/:sessionId/attendance')
  @ApiOperation({
    summary: 'List learners and attendance for a session (ENSEIGNANT only)',
  })
  getSessionAttendance(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessionAttendanceService.getSessionAttendance(
      user.id,
      sessionId,
    );
  }

  @Patch('me/sessions/:sessionId/attendance')
  @ApiOperation({
    summary: 'Bulk update attendance for a session (ENSEIGNANT only)',
  })
  @ApiBody({ type: UpdateSessionAttendanceDto })
  patchSessionAttendance(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateSessionAttendanceDto,
  ) {
    return this.sessionAttendanceService.updateSessionAttendance(
      user.id,
      sessionId,
      dto,
    );
  }

  @Get('me/formations/:formationId/tracking')
  @UseGuards(TeacherFormationAccessGuard)
  @ApiOperation({
    summary:
      'Formation tracking overview (sessions, attendance, learners, feedback)',
  })
  getMyFormationTracking(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
  ) {
    return this.teacherFormationTrackingService.getTeacherFormationTracking(
      user.id,
      formationId,
    );
  }

  @Get('me/formations/:formationId/feedback')
  @UseGuards(TeacherFormationAccessGuard)
  @ApiOperation({
    summary: 'Aggregated learner feedback for this formation (read-only)',
  })
  getMyFormationFeedback(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.teachersService.getTeacherFormationFeedback(
      user.id,
      formationId,
      query,
    );
  }

  @Get('me/formations/:formationId/sessions')
  @UseGuards(TeacherFormationAccessGuard)
  @ApiOperation({
    summary: 'List sessions for a formation you teach (read-only)',
  })
  getMyFormationSessions(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Query() query: FindTeacherFormationSessionsQueryDto,
  ) {
    return this.teachersService.getTeacherFormationSessions(
      user.id,
      formationId,
      query,
    );
  }

  @Get('me/formations/:formationId/enrollments')
  @UseGuards(TeacherFormationAccessGuard)
  @ApiOperation({ summary: 'Get my formation enrollments (ENSEIGNANT only)' })
  getMyFormationEnrollments(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.teachersService.getTeacherFormationEnrollments(
      user.id,
      formationId,
      query,
    );
  }

  @Get('me/formations/:formationId/certificates')
  @UseGuards(TeacherFormationAccessGuard)
  @ApiOperation({ summary: 'Get my formation certificates (ENSEIGNANT only)' })
  getMyFormationCertificates(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.teachersService.getTeacherFormationCertificates(
      user.id,
      formationId,
      query,
    );
  }
}
