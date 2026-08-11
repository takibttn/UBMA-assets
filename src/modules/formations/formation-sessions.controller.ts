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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import { FormationSessionsService } from './formation-sessions.service';
import { FormationSessionGenerationService } from './formation-session-generation.service';
import { CreateFormationSessionDto } from './dto/create-formation-session.dto';
import { UpdateFormationSessionDto } from './dto/update-formation-session.dto';
import { GenerateFormationSessionsDto } from './dto/generate-formation-sessions.dto';
import { GenerateSessionsPreviewResponseDto } from './dto/generated-sessions-preview-response.dto';

@ApiTags('formations')
@Controller('formations')
export class FormationSessionsController {
  constructor(
    private readonly formationSessionsService: FormationSessionsService,
    private readonly formationSessionGenerationService: FormationSessionGenerationService,
  ) {}

  @Post(':formationId/sessions/preview')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Preview generated séances from weekly slots (ADMIN only, no DB writes)',
  })
  @ApiResponse({ status: 200, type: GenerateSessionsPreviewResponseDto })
  previewGeneratedSessions(
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Body() dto: GenerateFormationSessionsDto,
  ) {
    return this.formationSessionGenerationService.previewGeneratedSessions(
      formationId,
      dto,
    );
  }

  @Post(':formationId/sessions/generate')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Generate and insert séances in one transaction if no conflicts (ADMIN only)',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Schedule conflict' })
  generateSessions(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Body() dto: GenerateFormationSessionsDto,
  ) {
    return this.formationSessionGenerationService.generateSessions(
      formationId,
      dto,
      user,
    );
  }

  @Post(':formationId/sessions')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create formation session (ADMIN only)' })
  @ApiResponse({ status: 201 })
  createSession(
    @CurrentUser() user: AuthUser,
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Body() dto: CreateFormationSessionDto,
  ) {
    return this.formationSessionsService.createSession(user, formationId, dto);
  }

  @Get(':formationId/sessions')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'List formation sessions (ADMIN only)' })
  listSessions(@Param('formationId', ParseUUIDPipe) formationId: string) {
    return this.formationSessionsService.listSessions(formationId);
  }

  @Get(':formationId/sessions/:sessionId')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get formation session (ADMIN only)' })
  getSession(
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.formationSessionsService.getSession(formationId, sessionId);
  }

  @Patch(':formationId/sessions/:sessionId')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update formation session (ADMIN only)' })
  updateSession(
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateFormationSessionDto,
  ) {
    return this.formationSessionsService.updateSession(
      formationId,
      sessionId,
      dto,
    );
  }

  @Delete(':formationId/sessions/:sessionId')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete formation session (ADMIN only)' })
  @ApiResponse({ status: 204 })
  deleteSession(
    @Param('formationId', ParseUUIDPipe) formationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.formationSessionsService.deleteSession(formationId, sessionId);
  }
}
