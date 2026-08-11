export type CreateCheckoutInput = {
  localPaymentId: string;
  enrollmentId: string;
  formationId: string;
  studentId: string;

  amount: string;
  amountMinor: number;
  currency: 'dzd';

  description: string;

  customer: {
    name: string;
    email: string | null;
  };

  successUrl: string;
  failureUrl: string;
  webhookEndpoint: string;

  metadata: Record<string, string>;
};

export type CreateCheckoutResult = {
  providerCheckoutId: string;
  checkoutUrl: string;
  status: string;
  expiresAt?: Date | null;
  raw: unknown;
};

export type ProviderWebhookEvent = {
  eventId: string;
  type: string;
  livemode: boolean;
  checkout: {
    id: string;
    status: string;
    amount: number;
    currency?: string | null;
    providerPaymentId?: string | null;
    raw: unknown;
  };
  raw: unknown;
};
