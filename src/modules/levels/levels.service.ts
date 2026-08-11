import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LevelsRepository } from '@lib/repositories/levels/levels.repository';
import { LanguagesRepository } from '@lib/repositories/languages/languages.repository';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { FindLevelsQueryDto } from './dto/find-levels-query.dto';

@Injectable()
export class LevelsService {
  constructor(
    private readonly levelsRepository: LevelsRepository,
    private readonly languagesRepository: LanguagesRepository,
  ) {}

  async getActiveLevels(query: FindLevelsQueryDto) {
    return this.levelsRepository.findAllActivePaginated(query);
  }

  async getLanguageLevels(languageId: string, query: FindLevelsQueryDto) {
    const language = await this.languagesRepository.findById(languageId);
    if (!language || !language.isActive) {
      throw new NotFoundException('Language not found or inactive');
    }
    return this.levelsRepository.findByLanguagePaginated(languageId, query);
  }

  async createLevel(dto: CreateLevelDto) {
    const language = await this.languagesRepository.findById(dto.languageId);
    if (!language || !language.isActive) {
      throw new NotFoundException('Language not found or inactive');
    }

    const existing = await this.levelsRepository.findByLanguageAndCode(
      dto.languageId,
      dto.code.toUpperCase(),
    );
    if (existing) {
      throw new ConflictException(
        'Level code already exists for this language',
      );
    }

    return this.levelsRepository.create({
      languageId: dto.languageId,
      code: dto.code.toUpperCase(),
      name: dto.name,
      description: dto.description,
      order: dto.order,
      isActive: dto.isActive ?? true,
    });
  }

  async updateLevel(id: string, dto: UpdateLevelDto) {
    const existing = await this.levelsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Level not found');
    }

    const finalLanguageId = dto.languageId ?? existing.languageId;
    const finalCode = dto.code?.toUpperCase() ?? existing.code;

    const language = await this.languagesRepository.findById(finalLanguageId);
    if (!language || !language.isActive) {
      throw new BadRequestException('Language not found or inactive');
    }

    const duplicate = await this.levelsRepository.findByLanguageAndCode(
      finalLanguageId,
      finalCode,
    );
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(
        'Level code already exists for this language',
      );
    }

    return this.levelsRepository.update(id, {
      ...(dto.languageId !== undefined ? { languageId: dto.languageId } : {}),
      ...(dto.code !== undefined ? { code: dto.code.toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  async deleteLevel(id: string) {
    const level = await this.levelsRepository.findById(id);
    if (!level) {
      throw new NotFoundException('Level not found');
    }
    return this.levelsRepository.softDelete(id);
  }
}
