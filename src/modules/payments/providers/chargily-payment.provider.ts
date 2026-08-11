import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProvider } from './payment-provider.interface';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProviderWebhookEvent,
} from './payment-provider.types';
import { verifyChargilySignature } from '../utils/chargily-signature.util';

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return value == null ? '' : JSON.stringify(value);
}

@Injectable()
export class ChargilyPaymentProvider implements PaymentProvider {
  readonly name = 'CHARGILY';

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const mode = this.config.get<string>('CHARGILY_MODE', 'test');
    return mode === 'live'
      ? (this.config.get<string>('CHARGILY_LIVE_BASE_URL') ??
          'https://pay.chargily.net/api/v2')
      : (this.config.get<string>('CHARGILY_TEST_BASE_URL') ??
          'https://pay.chargily.net/test/api/v2');
  }

  private secretKey(): string {
    const mode = this.config.get<string>('CHARGILY_MODE', 'test');
    const key =
      mode === 'live'
        ? this.config.get<string>('CHARGILY_LIVE_SECRET_KEY')
        : this.config.get<string>('CHARGILY_TEST_SECRET_KEY');
    if (!key) {
      throw new BadRequestException('Configuration Chargily incomplète');
    }
    return key;
  }

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const url = `${this.baseUrl().replace(/\/$/, '')}/checkouts`;
    const body = {
      amount: input.amountMinor,
      currency: input.currency,
      success_url: input.successUrl,
      failure_url: input.failureUrl,
      webhook_endpoint: input.webhookEndpoint,
      description: input.description,
      metadata: input.metadata,
      locale: this.config.get<string>('PAYMENT_CHECKOUT_LOCALE', 'fr'),
      payment_method: this.config.get<string>('PAYMENT_METHOD', 'edahabia'),
      chargily_pay_fees_allocation: this.config.get<string>(
        'PAYMENT_FEES_ALLOCATION',
        'customer',
      ),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException('Échec de création du paiement (Chargily)');
    }

    const checkout = (raw as Record<string, unknown>).checkout as
      | Record<string, unknown>
      | undefined;
    const top = checkout ?? (raw as Record<string, unknown>);
    const id = asString(top.id ?? top.checkout_id ?? '');
    const checkoutUrl = asString(
      top.checkout_url ?? top.url ?? top.payment_url ?? '',
    );
    if (!id || !checkoutUrl) {
      throw new BadRequestException('Réponse Chargily invalide');
    }

    let expiresAt: Date | null = null;
    const exp = top.expires_at ?? top.expired_at;
    if (typeof exp === 'string') {
      const d = new Date(exp);
      if (!Number.isNaN(d.getTime())) expiresAt = d;
    }

    return {
      providerCheckoutId: id,
      checkoutUrl,
      status: asString(top.status ?? 'pending'),
      expiresAt,
      raw,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires a Promise; the method does no I/O
  async verifyAndParseWebhook(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ProviderWebhookEvent> {
    const webhookSecret =
      this.config.get<string>('CHARGILY_WEBHOOK_SECRET')?.trim() ?? '';
    const secret = webhookSecret || this.secretKey();
    const headerName =
      this.config.get<string>(
        'CHARGILY_WEBHOOK_SIGNATURE_HEADER',
        'signature',
      ) ?? 'signature';
    const sigRaw = input.headers[headerName] ?? input.headers['Signature'];
    const signature = Array.isArray(sigRaw) ? sigRaw[0] : sigRaw;
    if (!signature) {
      throw new BadRequestException('Signature manquante');
    }

    const rawStr = Buffer.isBuffer(input.rawBody)
      ? input.rawBody.toString('utf8')
      : String(input.rawBody);

    if (
      !verifyChargilySignature({
        rawBody: rawStr,
        signature,
        secretKey: secret,
      })
    ) {
      throw new ForbiddenException('Signature invalide');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawStr) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Corps webhook invalide');
    }

    const type = asString(payload.type ?? payload.event ?? '');
    const eventId = asString(payload.id ?? payload.event_id ?? type);
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const chk = (data.checkout ?? data) as Record<string, unknown>;
    const checkoutId = asString(chk.id ?? chk.checkout_id ?? '');
    const status = asString(chk.status ?? '');
    const amount = Number(chk.amount ?? chk.total ?? 0);

    return {
      eventId,
      type,
      livemode: Boolean(payload.livemode),
      checkout: {
        id: checkoutId,
        status,
        amount: Number.isFinite(amount) ? amount : 0,
        currency: chk.currency != null ? asString(chk.currency) : null,
        providerPaymentId:
          chk.payment_id != null ? asString(chk.payment_id) : null,
        raw: chk,
      },
      raw: payload,
    };
  }
}
