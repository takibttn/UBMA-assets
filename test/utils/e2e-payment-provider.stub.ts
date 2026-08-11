import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProvider } from '../../src/modules/payments/providers/payment-provider.interface';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProviderWebhookEvent,
} from '../../src/modules/payments/providers/payment-provider.types';
import { verifyChargilySignature } from '../../src/modules/payments/utils/chargily-signature.util';

/**
 * Jest E2E only — replaces PAYMENT_PROVIDER so no HTTP calls to Chargily.
 * Not part of the shipped app. checkoutUrl points at success path (never opened in tests).
 */
@Injectable()
export class E2ePaymentProviderStub implements PaymentProvider {
  readonly name = 'CHARGILY';

  constructor(private readonly config: ConfigService) {}

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const providerCheckoutId = `e2e_chk_${input.localPaymentId.replace(/-/g, '').slice(0, 12)}`;
    const app =
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3000';
    const successPath =
      this.config.get<string>('PAYMENT_SUCCESS_PATH') ?? '/payment/success';
    const path = successPath.startsWith('/') ? successPath : `/${successPath}`;
    const checkoutUrl = `${app.replace(/\/$/, '')}${path}?paymentId=${encodeURIComponent(input.localPaymentId)}`;

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    return {
      providerCheckoutId,
      checkoutUrl,
      status: 'pending',
      expiresAt,
      raw: { e2eStub: true, providerCheckoutId },
    };
  }

  async verifyAndParseWebhook(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ProviderWebhookEvent> {
    const rawStr = Buffer.isBuffer(input.rawBody)
      ? input.rawBody.toString('utf8')
      : String(input.rawBody);

    const secret = this.config.get<string>('CHARGILY_WEBHOOK_SECRET') ?? '';
    const headerName =
      this.config.get<string>(
        'CHARGILY_WEBHOOK_SIGNATURE_HEADER',
        'signature',
      ) ?? 'signature';
    if (secret) {
      const sigRaw = input.headers[headerName] ?? input.headers['signature'];
      const signature = Array.isArray(sigRaw) ? sigRaw[0] : sigRaw;
      if (!signature) {
        throw new BadRequestException('Signature manquante');
      }
      if (
        !verifyChargilySignature({
          rawBody: rawStr,
          signature,
          secretKey: secret,
        })
      ) {
        throw new ForbiddenException('Signature invalide');
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawStr) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Corps webhook invalide');
    }

    const type = String(payload.type ?? 'checkout.paid');
    const eventId = String(payload.id ?? 'evt_e2e');
    const chk = (payload.checkout ?? payload.data ?? payload) as Record<
      string,
      unknown
    >;
    const checkoutId = String(chk.id ?? '');
    const status = String(chk.status ?? 'paid');
    const amount = Number(chk.amount ?? 0);

    return {
      eventId,
      type,
      livemode: false,
      checkout: {
        id: checkoutId,
        status,
        amount,
        currency: 'dzd',
        providerPaymentId: null,
        raw: chk,
      },
      raw: payload,
    };
  }
}
