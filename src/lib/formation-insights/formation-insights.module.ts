import { Module } from '@nestjs/common';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';

@Module({
  providers: [FormationFeedbackRepository, FormationTrackingRepository],
  exports: [FormationFeedbackRepository, FormationTrackingRepository],
})
export class FormationInsightsModule {}
