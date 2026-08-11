import type { TeacherAssignmentNotificationParams } from '../types/notification.types';

type TransactionalEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildTeacherAssignmentEmail(
  params: TeacherAssignmentNotificationParams,
): Pick<TransactionalEmailContent, 'subject' | 'text' | 'html'> {
  const subject = `[CEIL] Nouvelle assignation de formation : ${params.formationTitle}`;

  const text = [
    `Bonjour ${params.teacherName},`,
    '',
    `Nous vous informons que vous avez été assigné à la formation "${params.formationTitle}".`,
    '',
    `Dates prévues : du ${formatDate(params.startDate)} au ${formatDate(params.endDate)}.`,
    '',
    'Vous pouvez consulter les détails de cette formation et gérer vos séances depuis votre espace enseignant.',
    '',
    'Cordialement,',
    'L’administration du CEIL',
  ].join('\n');

  const html = [
    '<div style="font-family: sans-serif; line-height: 1.5; color: #333;">',
    `<p>Bonjour <strong>${escapeHtml(params.teacherName)}</strong>,</p>`,
    `<p>Nous vous informons que vous avez été assigné à la formation <strong>${escapeHtml(params.formationTitle)}</strong>.</p>`,
    '<p>',
    `<strong>Dates prévues :</strong> du ${formatDate(params.startDate)} au ${formatDate(params.endDate)}.<br>`,
    '</p>',
    '<p>Vous pouvez consulter les détails de cette formation et gérer vos séances depuis votre espace enseignant.</p>',
    '<p style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">',
    'Cordialement,<br>',
    '<strong>L’administration du CEIL</strong>',
    '</p>',
    '</div>',
  ].join('');

  return { subject, text, html };
}
