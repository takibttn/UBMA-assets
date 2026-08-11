import { Module } from '@nestjs/common';
import { LevelsController } from './levels.controller';
import { LevelsService } from './levels.service';
import { LevelsRepository } from '@lib/repositories/levels/levels.repository';
import { LanguagesRepository } from '@lib/repositories/languages/languages.repository';

@Module({
  controllers: [LevelsController],
  providers: [LevelsService, LevelsRepository, LanguagesRepository],
  exports: [LevelsService],
})
export class LevelsModule {}
