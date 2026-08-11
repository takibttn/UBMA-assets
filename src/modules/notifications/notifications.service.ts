import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailDispatchService } from './email/email-dispatch.service';
import { EnrollmentNotificationParams } from './types/notification.types';
import {
  buildEnrollmentAdminEmail,
  buildEnrollmentTeacherEmail,
} from './templates/enrollment-emails.template';
import { buildFormationStatusEmail } from './templates/formation-emails.template';
import { buildTeacherAssignmentEmail } from './templates/teacher-emails.template';
import {
  FormationStatusNotificationParams,
  TeacherAssignmentNotificationParams,
} from './types/notification.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly emailDispatch: EmailDispatchService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Enrollment emails to teacher (if any) and admin inbox. Non-throwing per recipient;
   * failures are logged only so enrollment flow is never blocked.
   */
  async sendEnrollmentNotification(
    params: EnrollmentNotificationParams,
  ): Promise<void> {
    if (!this.emailDispatch.isDispatchEnabled()) {
      this.logger.debug(
        `Skipping enrollment emails for enrollmentId=${params.enrollmentId} (Notifications disabled)`,
      );
      return;
    }

    const { teacherEmail, adminEmail } = params;
    const fallbackAdmin =
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL')?.trim() ?? '';
    const targetAdmin = adminEmail?.trim() || fallbackAdmin || '';

    if (teacherEmail?.trim()) {
      try {
        const body = buildEnrollmentTeacherEmail(params);
        await this.emailDispatch.sendTransactional({
          to: teacherEmail.trim(),
          ...body,
        });
        this.logger.log(
          `Enrollment email sent to teacher ${teacherEmail} for "${params.formationTitle}"`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send teacher enrollment email: ${(error as Error).message}`,
        );
      }
    }

    if (targetAdmin) {
      try {
        const body = buildEnrollmentAdminEmail(params);
        await this.emailDispatch.sendTransactional({
          to: targetAdmin,
          ...body,
        });
        this.logger.log(
          `Enrollment email sent to admin for enrollment ${params.enrollmentId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send admin enrollment email: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Notifies all enrolled learners and the teacher when a formation status changes.
   */
  async sendFormationStatusNotification(
    params: FormationStatusNotificationParams,
  ): Promise<void> {
    if (!this.emailDispatch.isDispatchEnabled()) {
      this.logger.debug(
        `Skipping formation status emails for formationId=${params.formationId} (Notifications disabled)`,
      );
      return;
    }

    const { learnerEmails, teacherEmail } = params;
    const allRecipients = new Set([
      ...learnerEmails.map((e) => e.trim().toLowerCase()),
      ...(teacherEmail ? [teacherEmail.trim().toLowerCase()] : []),
    ]);

    const recipients = Array.from(allRecipients).filter(Boolean);
    if (recipients.length === 0) return;

    try {
      const body = buildFormationStatusEmail(params);
      // We send one email with all recipients in BCC to avoid leaking emails
      // and to stay within Resend transactional limits (up to 50 in BCC usually).
      // If there are many, we might need a batch loop, but 50 is a safe start.
      await this.emailDispatch.sendTransactional({
        to: 'catazaki213@gmail.com', // Generic recipient for BCC bulk mails
        bcc: recipients,
        ...body,
      });
      this.logger.log(
        `Formation status email sent to ${recipients.length} recipients for "${params.formationTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send formation status email: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Notifies a teacher when they are assigned to a formation.
   */
  async sendTeacherAssignmentNotification(
    params: TeacherAssignmentNotificationParams,
  ): Promise<void> {
    if (!this.emailDispatch.isDispatchEnabled()) {
      this.logger.debug(
        `Skipping teacher assignment email for teacherEmail=${params.teacherEmail} (Notifications disabled)`,
      );
      return;
    }

    try {
      const body = buildTeacherAssignmentEmail(params);
      await this.emailDispatch.sendTransactional({
        to: params.teacherEmail.trim(),
        ...body,
      });
      this.logger.log(
        `Teacher assignment email sent to ${params.teacherEmail} for "${params.formationTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send teacher assignment email: ${(error as Error).message}`,
      );
    }
  }
}
