import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LanguagesRepository } from '@lib/repositories/languages/languages.repository';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { FindLanguagesQueryDto } from './dto/find-languages-query.dto';

@Injectable()
export class LanguagesService {
  constructor(private readonly languagesRepository: LanguagesRepository) {}

  async getActiveLanguages(query: FindLanguagesQueryDto) {
    return this.languagesRepository.findAllActivePaginated(query);
  }

  async getLanguageById(id: string) {
    const language = await this.languagesRepository.findById(id);
    if (!language) {
      throw new NotFoundException('Language not found');
    }
    return language;
  }

  async createLanguage(dto: CreateLanguageDto) {
    const existing = await this.languagesRepository.findByCode(
      dto.code.toUpperCase(),
    );
    if (existing) {
      throw new ConflictException('Language code already exists');
    }

    return this.languagesRepository.create({
      name: dto.name,
      code: dto.code.toUpperCase(),
      isActive: dto.isActive ?? true,
    });
  }

  async updateLanguage(id: string, dto: UpdateLanguageDto) {
    await this.getLanguageById(id);

    if (dto.code) {
      const existing = await this.languagesRepository.findByCode(
        dto.code.toUpperCase(),
      );
      if (existing && existing.id !== id) {
        throw new ConflictException('Language code already exists');
      }
    }

    return this.languagesRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.code !== undefined ? { code: dto.code.toUpperCase() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  async deleteLanguage(id: string) {
    await this.getLanguageById(id);
    return this.languagesRepository.softDelete(id);
  }
}
