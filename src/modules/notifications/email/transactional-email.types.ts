/**
 * Provider-agnostic outbound message (Resend today; swappable later).
 */
export type TransactionalEmailMessage = {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  text: string;
  html?: string;
};
