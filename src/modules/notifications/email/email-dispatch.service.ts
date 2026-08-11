import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend, type ErrorResponse } from 'resend';
import type { TransactionalEmailMessage } from './transactional-email.types';

/**
 * Low-level Email dispatch: supports multiple providers (Resend, Console).
 * Handles environment-driven policies (enabled/disabled) and robust logging.
 */
@Injectable()
export class EmailDispatchService {
  private readonly logger = new Logger(EmailDispatchService.name);
  private readonly client: Resend | null = null;
  private readonly provider: 'resend' | 'console';
  private readonly isEnabled: boolean;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const enabled = this.configService.get<string | boolean>(
      'NOTIFICATIONS_EMAIL_ENABLED',
    );
    this.isEnabled = enabled === 'true' || enabled === true;
    this.provider = this.configService.get<'resend' | 'console'>(
      'EMAIL_PROVIDER',
      'console',
    );
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') ||
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      '';

    if (this.provider === 'resend') {
      const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
      if (apiKey) {
        this.client = new Resend(apiKey);
      } else if (this.isEnabled) {
        this.logger.error(
          'EMAIL_PROVIDER=resend but RESEND_API_KEY is missing.',
        );
      }
    }

    this.validateConfig();
  }

  private validateConfig() {
    if (!this.isEnabled) {
      this.logger.log('Email notifications are DISABLED globally.');
      return;
    }

    this.logger.log(
      `Email notifications ENABLED via provider: ${this.provider.toUpperCase()}`,
    );

    if (!this.fromEmail) {
      this.logger.error(
        'EMAIL_FROM is not configured. Email dispatch will fail.',
      );
    } else if (
      this.fromEmail.match(/@(gmail|yahoo|outlook|hotmail|live)\.com/i)
    ) {
      this.logger.warn(
        `EMAIL_FROM uses a public domain (${this.fromEmail}). Resend requires a verified custom domain for production dispatches.`,
      );
    }
  }

  /**
   * True when a send may be attempted based on provider and policy.
   */
  isDispatchEnabled(): boolean {
    if (!this.isEnabled) return false;
    if (this.provider === 'console') return true;
    if (this.provider === 'resend')
      return Boolean(this.client && this.fromEmail);
    return false;
  }

  /**
   * Sends one message. Non-blocking for the caller if handled correctly in NotificationsService.
   */
  async sendTransactional(message: TransactionalEmailMessage): Promise<void> {
    const recipients = Array.isArray(message.to)
      ? message.to.join(', ')
      : message.to;

    if (!this.isDispatchEnabled()) {
      this.logger.debug(
        `Email skipped (Disabled or missing config): to=${recipients} subject="${message.subject}"`,
      );
      return;
    }

    if (this.provider === 'console') {
      this.logConsolePreview(message);
      return;
    }

    try {
      this.logger.log(
        `[EMAIL] Dispatching via Resend: to=${recipients} subject="${message.subject}"`,
      );

      const { data, error } = await this.client!.emails.send({
        from: this.fromEmail,
        to: message.to,
        bcc: message.bcc,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (error) {
        this.handleResendError(error, recipients);
        throw new Error(error.message);
      }

      this.logger.log(`[EMAIL] Sent successfully. ID: ${data?.id}`);
    } catch (err) {
      this.handleUnexpectedError(err, recipients);
      throw err;
    }
  }

  private logConsolePreview(message: TransactionalEmailMessage) {
    const recipients = Array.isArray(message.to)
      ? message.to.join(', ')
      : message.to;
    this.logger.log(`
╔════════════════════════ [CONSOLE EMAIL PREVIEW] ════════════════════════
║ From:    ${this.fromEmail}
║ To:      ${recipients}
║ BCC:     ${message.bcc ? (Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc) : 'None'}
║ Subject: ${message.subject}
╠─────────────────────────────────────────────────────────────────────────
║ Text Preview:
║ ${message.text.split('\n').slice(0, 3).join('\n║ ')} ...
╚═════════════════════════════════════════════════════════════════════════
    `);
  }

  private handleResendError(error: ErrorResponse, recipients: string) {
    const formatted = {
      provider: 'resend',
      name: error.name || 'ResendError',
      message: error.message,
      statusCode: error.statusCode,
    };
    this.logger.error(
      `[EMAIL] Provider error for ${recipients}: ${JSON.stringify(formatted)}`,
    );
  }

  private handleUnexpectedError(err: unknown, recipients: string) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(
      `[EMAIL] Unexpected error dispatching to ${recipients}: ${message}`,
    );
    if (err instanceof Error && err.stack) {
      this.logger.debug(err.stack);
    }
  }
}
