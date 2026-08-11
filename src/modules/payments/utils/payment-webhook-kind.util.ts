import type { ProviderWebhookEvent } from '../providers/payment-provider.types';

export type WebhookPaymentKind =
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'processing'
  | 'pending'
  | 'unknown';

export function resolveWebhookPaymentKind(
  event: ProviderWebhookEvent,
): WebhookPaymentKind {
  const type = event.type.toLowerCase();
  if (type.includes('expired')) return 'expired';
  if (type.includes('canceled') || type.includes('cancelled'))
    return 'cancelled';
  if (type.includes('failed')) return 'failed';
  if (type.includes('processing')) return 'processing';
  if (type.includes('.pending') || type.endsWith('pending')) return 'pending';
  if (type.includes('paid')) return 'paid';

  const st = event.checkout.status.toLowerCase();
  if (st === 'expired') return 'expired';
  if (st === 'canceled' || st === 'cancelled') return 'cancelled';
  if (st === 'failed') return 'failed';
  if (st === 'processing') return 'processing';
  if (st === 'pending') return 'pending';
  if (st === 'paid') return 'paid';
  return 'unknown';
}
