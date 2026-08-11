import { Inject, Injectable } from '@nestjs/common';
import { DashboardRepository } from '@lib/repositories/dashboard/dashboard.repository';
import { EnrollmentsService } from '@modules/enrollments/enrollments.service';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';
import { DashboardServiceRoles } from './dashboard.service.roles';

@Injectable()
export class DashboardService extends DashboardServiceRoles {
  constructor(
    @Inject(DashboardRepository) dashboardRepository: DashboardRepository,
    @Inject(EnrollmentsService) enrollmentsService: EnrollmentsService,
    @Inject(FormationFeedbackRepository)
    formationFeedbackRepository: FormationFeedbackRepository,
    @Inject(FormationTrackingRepository)
    formationTrackingRepository: FormationTrackingRepository,
  ) {
    super(
      dashboardRepository,
      enrollmentsService,
      formationFeedbackRepository,
      formationTrackingRepository,
    );
  }
}
