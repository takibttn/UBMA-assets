import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormationsService } from './formations.service';
import { CreateFormationDto } from './dto/create-formation.dto';
import { CreateFormationWithSessionsDto } from './dto/create-formation-with-sessions.dto';
import { UpdateFormationDto } from './dto/update-formation.dto';
import { ToggleSaleDto } from './dto/toggle-sale.dto';
import { FindFormationsQueryDto } from './dto/find-formations-query.dto';
import { AdminFormationStatsDto } from './dto/admin-formation-stats.dto';
import { AdminFormationAnalyticsDto } from './dto/admin-formation-analytics.dto';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { FormationFeedbackService } from './formation-feedback.service';
import { UpsertFormationFeedbackDto } from './dto/upsert-formation-feedback.dto';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';
import { UserRole } from '@modules/auth/types/user-role.type';
import { OptionalJwtAuthGuard } from '@lib/guards/optional-jwt-auth.guard';

@ApiTags('formations')
@Controller('formations')
export class FormationsController {
  constructor(
    private readonly formationsService: FormationsService,
    private readonly formationFeedbackService: FormationFeedbackService,
  ) {}

  @Post()
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a formation (ADMIN only)' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFormationDto) {
    return this.formationsService.createFormation(user, dto);
  }

  @Post('with-sessions')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Create formation, teacher assignments, and sessions in one transaction (ADMIN only)',
  })
  @ApiResponse({ status: 201 })
  createWithSessions(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFormationWithSessionsDto,
  ) {
    return this.formationsService.createFormationWithSessions(user, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get all formations (paginated, public)',
    description:
      'No authentication required. Optional Bearer token: if role is APPRENANT, each item includes canEnroll and myEnrollment. Optional `saleStatus`: OPEN | CLOSED | ALL (omit for no filter).',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query e.g. unknown saleStatus',
  })
  findAll(
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: FindFormationsQueryDto,
  ) {
    return this.formationsService.getAllFormations(query, user);
  }

  // ─── Admin analytics (must be declared BEFORE :id routes) ─────────────────

  @Get('admin/stats')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin formations stats cards (ADMIN only)' })
  @ApiOkResponse({ type: AdminFormationStatsDto })
  getAdminStats(): Promise<AdminFormationStatsDto> {
    return this.formationsService.getAdminStats();
  }

  @Get('admin/analytics')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Admin formations analytics for chart tabs: byStatus, byLanguage, byLevel (ADMIN only)',
  })
  @ApiOkResponse({ type: AdminFormationAnalyticsDto })
  getAdminAnalytics(): Promise<AdminFormationAnalyticsDto> {
    return this.formationsService.getAdminAnalytics();
  }

  @Get(':id/tracking')
  @Auth(UserRole.ADMIN, UserRole.ENSEIGNANT)
  @ApiOperation({
    summary:
      'Formation analytics for charts (ADMIN; ENSEIGNANT if assigned to formation)',
  })
  getFormationTracking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formationsService.getFormationTrackingAnalytics(id, user);
  }

  @Put(':id/feedback')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({ summary: 'Create or update my feedback for a formation' })
  upsertMyFormationFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertFormationFeedbackDto,
  ) {
    return this.formationFeedbackService.upsertMyFeedback(user.id, id, dto);
  }

  @Get(':id/feedback/me')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({ summary: 'Get my feedback for a formation' })
  getMyFormationFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formationFeedbackService.getMyFeedback(user.id, id);
  }

  @Get(':id/feedback')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin: paginated feedback list with learner details',
  })
  getAdminFormationFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.formationFeedbackService.getAdminFormationFeedback(id, query);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get formation by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formationsService.getFormationById(id, user);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a formation (ADMIN only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormationDto,
  ) {
    return this.formationsService.updateFormation(id, dto);
  }

  @Patch(':id/sale')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle sale status (ADMIN only)' })
  toggleSale(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSaleDto,
  ) {
    return this.formationsService.toggleSale(id, dto.isSaleOpen);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a formation (ADMIN only)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.formationsService.deleteFormation(id);
  }
}
