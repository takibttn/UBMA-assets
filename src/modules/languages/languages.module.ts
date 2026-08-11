import { Module } from '@nestjs/common';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';
import { LanguagesRepository } from '@lib/repositories/languages/languages.repository';

@Module({
  controllers: [LanguagesController],
  providers: [LanguagesService, LanguagesRepository],
  exports: [LanguagesService, LanguagesRepository],
})
export class LanguagesModule {}
