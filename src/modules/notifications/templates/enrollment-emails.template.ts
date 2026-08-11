import type { EnrollmentNotificationParams } from '../types/notification.types';

type TransactionalEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function matriculeLine(studentMatricule: string | null): string {
  return studentMatricule
    ? `Matricule: ${studentMatricule}`
    : 'Matricule: (external learner — no matricule)';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email to the main teacher when a learner enrolls (plain + minimal HTML).
 */
export function buildEnrollmentTeacherEmail(
  params: EnrollmentNotificationParams,
): Pick<TransactionalEmailContent, 'subject' | 'text' | 'html'> {
  const line = matriculeLine(params.studentMatricule);
  const subject = `Nouvelle inscription CEIL — ${params.formationTitle}`;
  const text = [
    'Bonjour,',
    "Un nouvel étudiant s'est inscrit à votre formation CEIL.",
    '',
    `Étudiant: ${params.studentFullName}`,
    line,
    `Formation: ${params.formationTitle}`,
  ].join('\n');
  const html = [
    '<p>Bonjour,</p>',
    "<p>Un nouvel étudiant s'est inscrit à votre formation CEIL.</p>",
    '<ul>',
    `<li><strong>Étudiant:</strong> ${escapeHtml(params.studentFullName)}</li>`,
    `<li><strong>${escapeHtml(line)}</strong></li>`,
    `<li><strong>Formation:</strong> ${escapeHtml(params.formationTitle)}</li>`,
    '</ul>',
  ].join('');
  return { subject, text, html };
}

/**
 * Email to platform admin(s) when a learner enrolls.
 */
export function buildEnrollmentAdminEmail(
  params: EnrollmentNotificationParams,
): Pick<TransactionalEmailContent, 'subject' | 'text' | 'html'> {
  const line = matriculeLine(params.studentMatricule);
  const subject = 'Nouvelle inscription CEIL';
  const text = [
    'Nouvelle inscription enregistrée.',
    '',
    `Étudiant: ${params.studentFullName}`,
    line,
    `Formation: ${params.formationTitle}`,
    `Enrollment ID: ${params.enrollmentId}`,
  ].join('\n');
  const html = [
    '<p>Nouvelle inscription enregistrée.</p>',
    '<ul>',
    `<li><strong>Étudiant:</strong> ${escapeHtml(params.studentFullName)}</li>`,
    `<li><strong>${escapeHtml(line)}</strong></li>`,
    `<li><strong>Formation:</strong> ${escapeHtml(params.formationTitle)}</li>`,
    `<li><strong>Enrollment ID:</strong> ${escapeHtml(params.enrollmentId)}</li>`,
    '</ul>',
  ].join('');
  return { subject, text, html };
}
