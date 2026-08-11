import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto';
import { FindLearnerProfileEnrollmentsQueryDto } from './dto/find-learner-profile-enrollments-query.dto';
import { FormationEnrollmentRosterPageDto } from './dto/formation-enrollment-roster.dto';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';

@ApiTags('enrollments')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post(':enrollmentId/payment/retry')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({
    summary:
      'Retry or reuse an open checkout for a PENDING_PAYMENT enrollment (APPRENANT)',
  })
  retryPayment(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.enrollmentsService.retryEnrollmentPayment(user, enrollmentId);
  }

  @Post()
  @Auth(UserRole.APPRENANT)
  @ApiOperation({
    summary:
      'Enroll in a formation (APPRENANT). Paid formations return payment.checkoutUrl; confirmation is asynchronous via webhook.',
  })
  @ApiResponse({ status: 201 })
  enroll(@CurrentUser() user: AuthUser, @Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.enrollStudent(user, dto);
  }

  @Get('me/profile')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({
    summary:
      'Learner profile enrollments — card-shaped rows, filter by IN_PROGRESS / COMPLETED / ALL',
  })
  getMyProfileEnrollments(
    @CurrentUser() user: AuthUser,
    @Query() query: FindLearnerProfileEnrollmentsQueryDto,
  ) {
    return this.enrollmentsService.getMyProfileEnrollments(user, query);
  }

  @Get('me')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({
    summary: 'Get my enrollments (APPRENANT only)',
    deprecated: true,
    description:
      'Prefer GET /enrollments/me/profile for card UI and progressState. Raw enrollment rows.',
  })
  getMyEnrollments(
    @CurrentUser() user: AuthUser,
    @Query() query: FindEnrollmentsQueryDto,
  ) {
    return this.enrollmentsService.getMyEnrollments(user, query);
  }

  @Get()
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all enrollments (ADMIN only)' })
  findAll(@Query() query: FindEnrollmentsQueryDto) {
    return this.enrollmentsService.getAllEnrollments(query);
  }

  @Get('teacher')
  @Auth(UserRole.ENSEIGNANT)
  @ApiOperation({
    summary:
      'List enrollments for formations you teach (student summary, formation summary, identifier)',
  })
  getTeacherEnrollments(
    @CurrentUser() user: AuthUser,
    @Query() query: FindEnrollmentsQueryDto,
  ) {
    return this.enrollmentsService.getTeacherEnrollments(user, query);
  }

  @Get('teacher/:enrollmentId')
  @Auth(UserRole.ENSEIGNANT)
  @ApiOperation({
    summary:
      'Get one enrollment with full student, formation, and optional certificate (ENSEIGNANT only)',
  })
  @ApiResponse({
    status: 404,
    description: 'Enrollment not found or formation not assigned to you',
  })
  getTeacherEnrollmentById(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.enrollmentsService.getTeacherEnrollmentById(user, enrollmentId);
  }

  @Get('formation/:formationId')
  @Auth(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List enrollments for a formation (ADMIN)',
    description:
      'Paginated roster with embedded `student` (name, email, matricule). `status` omitted returns all statuses. Supports `search` on learner name/email/matricule.',
  })
  @ApiResponse({ status: 200, type: FormationEnrollmentRosterPageDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Formation not found' })
  getFormationEnrollments(
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Query() query: FindEnrollmentsQueryDto,
  ) {
    return this.enrollmentsService.getFormationEnrollments(formationId, query);
  }
}
