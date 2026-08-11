import { Module } from '@nestjs/common';
import { FormationsController } from './formations.controller';
import { FormationSessionsController } from './formation-sessions.controller';
import { FormationsService } from './formations.service';
import { FormationFeedbackService } from './formation-feedback.service';
import { FormationSessionsService } from './formation-sessions.service';
import { FormationSessionGenerationService } from './formation-session-generation.service';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { FormationSessionsRepository } from '@lib/repositories/formation-sessions/formation-sessions.repository';
import { LanguagesRepository } from '@lib/repositories/languages/languages.repository';
import { LevelsRepository } from '@lib/repositories/levels/levels.repository';
import { FormationInsightsModule } from '@lib/formation-insights/formation-insights.module';
import { SchedulingModule } from '@lib/scheduling/scheduling.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { TeachersModule } from '@modules/teachers/teachers.module';
import { EnrollmentsModule } from '@modules/enrollments/enrollments.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    TeachersModule,
    EnrollmentsModule,
    FormationInsightsModule,
    SchedulingModule,
    RoomsModule,
    NotificationsModule,
  ],
  controllers: [FormationsController, FormationSessionsController],
  providers: [
    FormationsService,
    FormationFeedbackService,
    FormationSessionsService,
    FormationSessionGenerationService,
    FormationsRepository,
    FormationSessionsRepository,
    LanguagesRepository,
    LevelsRepository,
  ],
  exports: [
    FormationsService,
    FormationSessionsService,
    FormationSessionsRepository,
  ],
})
export class FormationsModule {}
