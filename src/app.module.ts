import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FormationsModule } from './modules/formations/formations.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { LevelsModule } from './modules/levels/levels.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    FormationsModule,
    EnrollmentsModule,
    CalendarModule,
    NotificationsModule,
    DashboardModule,
    CertificatesModule,
    LanguagesModule,
    LevelsModule,
    TeachersModule,
    RoomsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
