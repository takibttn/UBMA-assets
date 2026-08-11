import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailDispatchService } from './email/email-dispatch.service';

@Module({
  controllers: [NotificationsController],
  providers: [EmailDispatchService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
