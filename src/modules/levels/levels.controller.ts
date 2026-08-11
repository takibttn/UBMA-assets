import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '@lib/decorators/auth.decorator';
import { UserRole } from '@modules/auth/types/user-role.type';
import { LevelsService } from './levels.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { FindLevelsQueryDto } from './dto/find-levels-query.dto';

@ApiTags('levels')
@Controller()
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get('levels')
  @Auth()
  @ApiOperation({ summary: 'Get active levels' })
  @ApiQuery({ name: 'languageId', required: false, type: String })
  findAll(@Query() query: FindLevelsQueryDto) {
    return this.levelsService.getActiveLevels(query);
  }

  @Get('languages/:languageId/levels')
  @Auth()
  @ApiOperation({ summary: 'Get active levels for a language' })
  findByLanguage(
    @Param('languageId', ParseUUIDPipe) languageId: string,
    @Query() query: FindLevelsQueryDto,
  ) {
    return this.levelsService.getLanguageLevels(languageId, query);
  }

  @Post('levels')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create level (ADMIN only)' })
  create(@Body() dto: CreateLevelDto) {
    return this.levelsService.createLevel(dto);
  }

  @Patch('levels/:id')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update level (ADMIN only)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLevelDto) {
    return this.levelsService.updateLevel(id, dto);
  }

  @Delete('levels/:id')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate level (ADMIN only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.levelsService.deleteLevel(id);
  }
}
