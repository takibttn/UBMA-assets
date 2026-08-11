import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { insertFormationWithRefs, insertLearnerUser } from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';
import { signChargilyPayload } from '../src/modules/payments/utils/chargily-signature.util';
import { enrollments, payments } from '../src/database/schema';

function webhookHeaderName() {
  return process.env.CHARGILY_WEBHOOK_SIGNATURE_HEADER?.trim() || 'signature';
}

describe('Payments webhook (HMAC + lifecycle)', () => {
  let ctx: E2eContext;
  let app: INestApplication;
  const secret = () =>
    process.env.CHARGILY_WEBHOOK_SECRET ?? 'test-webhook-hmac-secret';

  beforeAll(async () => {
    await truncateTestTables();
    ctx = await createE2eApp();
    app = ctx.app;
  });

  beforeEach(async () => {
    await truncateTestTables();
  });

  afterAll(async () => {
    await app.close();
  });

  function postWebhook(payload: Record<string, unknown>) {
    const raw = JSON.stringify(payload);
    const sig = signChargilyPayload(raw, secret());
    return api(app)
      .post('/api/v1/payments/webhook/chargily')
      .set('Content-Type', 'application/json')
      .set(webhookHeaderName(), sig)
      .send(raw);
  }

  it('missing signature → 400', async () => {
    await api(app)
      .post('/api/v1/payments/webhook/chargily')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'checkout.paid', checkout: { id: 'x' } }))
      .expect(400);
  });

  it('invalid signature → 403', async () => {
    const raw = JSON.stringify({
      type: 'checkout.paid',
      checkout: { id: 'x', status: 'paid', amount: 1 },
    });
    await api(app)
      .post('/api/v1/payments/webhook/chargily')
      .set('Content-Type', 'application/json')
      .set(webhookHeaderName(), 'deadbeef')
      .send(raw)
      .expect(403);
  });

  it('checkout.paid → ENROLLED + PAID; second call idempotent', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '100',
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    const [p0] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.enrollmentId, res.body.enrollment.id));
    const checkoutId = p0.providerCheckoutId!;

    await postWebhook({
      type: 'checkout.paid',
      checkout: {
        id: checkoutId,
        status: 'paid',
        amount: 100,
      },
    }).expect(200);

    const [p1] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.id, p0.id));
    expect(p1?.status).toBe('PAID');

    const [e1] = await ctx.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, res.body.enrollment.id));
    expect(e1?.status).toBe('ENROLLED');

    await postWebhook({
      type: 'checkout.paid',
      checkout: {
        id: checkoutId,
        status: 'paid',
        amount: 100,
      },
    }).expect(200);

    const [p2] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.id, p0.id));
    expect(p2?.status).toBe('PAID');
  });

  it('checkout.failed keeps enrollment PENDING_PAYMENT', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '20',
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    const [p0] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.enrollmentId, res.body.enrollment.id));

    await postWebhook({
      type: 'checkout.failed',
      checkout: {
        id: p0.providerCheckoutId!,
        status: 'failed',
        amount: 20,
      },
    }).expect(200);

    const [p1] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.id, p0.id));
    expect(p1?.status).toBe('FAILED');
    const [e1] = await ctx.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, res.body.enrollment.id));
    expect(e1?.status).toBe('PENDING_PAYMENT');
  });

  it('checkout.canceled / expired → enrollment CANCELLED', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '30',
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    const [p0] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.enrollmentId, res.body.enrollment.id));

    await postWebhook({
      type: 'checkout.canceled',
      checkout: {
        id: p0.providerCheckoutId!,
        status: 'canceled',
        amount: 30,
      },
    }).expect(200);

    const [p1] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.id, p0.id));
    expect(p1?.status).toBe('CANCELLED');
    const [e1] = await ctx.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, res.body.enrollment.id));
    expect(e1?.status).toBe('CANCELLED');
  });

  it('amount mismatch does not mark PAID', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '77',
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    const [p0] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.enrollmentId, res.body.enrollment.id));

    await postWebhook({
      type: 'checkout.paid',
      checkout: {
        id: p0.providerCheckoutId!,
        status: 'paid',
        amount: 1,
      },
    }).expect(200);

    const [p1] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.id, p0.id));
    expect(p1?.status).toBe('PENDING');
    const [e1] = await ctx.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, res.body.enrollment.id));
    expect(e1?.status).toBe('PENDING_PAYMENT');
  });
});
