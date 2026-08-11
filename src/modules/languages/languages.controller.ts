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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '@lib/decorators/auth.decorator';
import { UserRole } from '@modules/auth/types/user-role.type';
import { LanguagesService } from './languages.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { FindLanguagesQueryDto } from './dto/find-languages-query.dto';

@ApiTags('languages')
@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Get active languages' })
  findAll(@Query() query: FindLanguagesQueryDto) {
    return this.languagesService.getActiveLanguages(query);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get language by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.languagesService.getLanguageById(id);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create language (ADMIN only)' })
  create(@Body() dto: CreateLanguageDto) {
    return this.languagesService.createLanguage(dto);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update language (ADMIN only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLanguageDto,
  ) {
    return this.languagesService.updateLanguage(id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate language (ADMIN only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.languagesService.deleteLanguage(id);
  }
}
