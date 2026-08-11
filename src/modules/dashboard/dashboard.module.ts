import { Module, forwardRef } from '@nestjs/common';
import { FormationInsightsModule } from '@lib/formation-insights/formation-insights.module';
import { DashboardRepository } from '@lib/repositories/dashboard/dashboard.repository';
import { EnrollmentsModule } from '@modules/enrollments/enrollments.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [forwardRef(() => EnrollmentsModule), FormationInsightsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
