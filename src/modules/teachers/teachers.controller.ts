import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import { AdminTeacherStatsDto } from './dto/admin-teacher-stats.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { FindTeacherCalendarQueryDto } from './dto/find-teacher-calendar-query.dto';
import { FindTeacherFormationsQueryDto } from './dto/find-teacher-formations-query.dto';
import { FindTeachersQueryDto } from './dto/find-teachers-query.dto';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@Controller('teachers')
@Auth(UserRole.ADMIN)
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a teacher account (ADMIN only)' })
  @ApiCreatedResponse({
    description: 'Teacher created (password excluded)',
  })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.teachersService.createTeacher(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List teachers (ADMIN only)' })
  findTeachers(@Query() query: FindTeachersQueryDto) {
    return this.teachersService.getTeachers(query);
  }

  @Get('admin/stats')
  @ApiOperation({
    summary: 'Admin teachers stats cards — counts for dashboard (ADMIN only)',
  })
  @ApiOkResponse({ type: AdminTeacherStatsDto })
  getAdminTeacherStats(): Promise<AdminTeacherStatsDto> {
    return this.teachersService.getAdminTeacherStats();
  }

  @Get(':teacherId')
  @ApiOperation({ summary: 'Get teacher details (ADMIN only)' })
  findTeacherById(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    return this.teachersService.getTeacherById(teacherId);
  }

  @Get(':teacherId/formations')
  @ApiOperation({ summary: 'Get teacher formations (ADMIN only)' })
  findTeacherFormations(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query() query: FindTeacherFormationsQueryDto,
  ) {
    return this.teachersService.getTeacherFormations(teacherId, query);
  }

  @Post(':teacherId/formations/:formationId')
  @ApiOperation({ summary: 'Assign teacher to formation (ADMIN only)' })
  @ApiResponse({ status: 201 })
  assignTeacherToFormation(
    @CurrentUser() user: AuthUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('formationId', ParseUUIDPipe) formationId: string,
  ) {
    return this.teacherAssignmentsService.assignTeacherToFormation(
      user,
      teacherId,
      formationId,
    );
  }

  @Delete(':teacherId/formations/:formationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unassign teacher from formation (ADMIN only)' })
  @ApiResponse({ status: 204 })
  unassignTeacherFromFormation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('formationId', ParseUUIDPipe) formationId: string,
  ) {
    return this.teacherAssignmentsService.unassignTeacherFromFormation(
      teacherId,
      formationId,
    );
  }

  @Get(':teacherId/calendar')
  @ApiOperation({ summary: 'Get teacher calendar (ADMIN only)' })
  getTeacherCalendar(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query() query: FindTeacherCalendarQueryDto,
  ) {
    return this.teachersService.getTeacherCalendar(teacherId, query);
  }
}
