import type { FormationStatusNotificationParams } from '../types/notification.types';

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

export function buildFormationStatusEmail(
  params: FormationStatusNotificationParams,
): Pick<TransactionalEmailContent, 'subject' | 'text' | 'html'> {
  const status = params.isSaleOpen ? 'LANCÉE' : 'ANNULÉE';
  const action = params.isSaleOpen ? 'lancée' : 'annulée';
  const description = params.isSaleOpen
    ? 'Les inscriptions sont désormais ouvertes.'
    : 'Les inscriptions sont désormais fermées. Si vous étiez déjà inscrit, veuillez contacter l’administration pour plus d’informations.';

  const subject = `[CEIL] Formation ${status} : ${params.formationTitle}`;

  const text = [
    'Bonjour,',
    '',
    `Nous vous informons que la formation "${params.formationTitle}" a été ${action}.`,
    description,
    '',
    'Cordialement,',
    'L’administration du CEIL',
  ].join('\n');

  const html = [
    '<div style="font-family: sans-serif; line-height: 1.5; color: #333;">',
    '<p>Bonjour,</p>',
    `<p>Nous vous informons que la formation <strong>${escapeHtml(params.formationTitle)}</strong> a été <strong>${action}</strong>.</p>`,
    `<p>${description}</p>`,
    '<p style="margin-top: 20px; border-top: 1px solid #eee; pt-4;">',
    'Cordialement,<br>',
    '<strong>L’administration du CEIL</strong>',
    '</p>',
    '</div>',
  ].join('');

  return { subject, text, html };
}
