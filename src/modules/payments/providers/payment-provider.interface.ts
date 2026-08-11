import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProviderWebhookEvent,
} from './payment-provider.types';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  readonly name: string;

  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;

  verifyAndParseWebhook(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ProviderWebhookEvent>;
}
