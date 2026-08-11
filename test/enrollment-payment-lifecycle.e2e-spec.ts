import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  assignTeacherToFormation,
  insertEnrollment,
  insertFormationWithRefs,
  insertLearnerUser,
  insertTeacher,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';
import { payments } from '../src/database/schema';

describe('Enrollment + payment lifecycle (E2E payment stub)', () => {
  let ctx: E2eContext;
  let app: INestApplication;

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

  it('free formation: paymentRequired=false, ENROLLED, no payment row', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, { price: '0' });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);

    expect(res.body.paymentRequired).toBe(false);
    expect(res.body.enrollment.status).toBe('ENROLLED');
    const prow = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.enrollmentId, res.body.enrollment.id));
    expect(prow.length).toBe(0);
  });

  it('paid formation: PENDING_PAYMENT, payment with checkoutUrl', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '1500',
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);

    expect(res.body.paymentRequired).toBe(true);
    expect(res.body.payment?.checkoutUrl).toBeTruthy();
    expect(res.body.enrollment.status).toBe('PENDING_PAYMENT');
    const [p] = await ctx.db
      .select()
      .from(payments)
      .where(eq(payments.enrollmentId, res.body.enrollment.id));
    expect(p?.status).toBe('PENDING');
  });

  it('duplicate POST while PENDING reuses checkout (same enrollment id)', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '80',
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const r1 = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    const r2 = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);

    expect(r2.body.enrollment.id).toBe(r1.body.enrollment.id);
    expect(r2.body.payment?.id).toBe(r1.body.payment?.id);
  });

  it('capacity reserves PENDING_PAYMENT seat', async () => {
    const a = await insertLearnerUser(ctx.db);
    const b = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 1,
      price: '10',
    });
    const tA = await loginAsUser(app, a.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(tA))
      .send({ formationId: formation.id })
      .expect(201);
    const tB = await loginAsUser(app, b.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(tB))
      .send({ formationId: formation.id })
      .expect(400);
  });

  it('cancelled free row reactivates to ENROLLED', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, { price: '0' });
    const row = await insertEnrollment(
      ctx.db,
      learner.id,
      formation.id,
      'CANCELLED',
    );
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    expect(res.body.enrollment.id).toBe(row.id);
    expect(res.body.enrollment.status).toBe('ENROLLED');
    expect(res.body.paymentRequired).toBe(false);
  });

  it('cancelled paid row reactivates to PENDING_PAYMENT with new checkout', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      price: '42',
    });
    const row = await insertEnrollment(
      ctx.db,
      learner.id,
      formation.id,
      'CANCELLED',
    );
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);
    expect(res.body.enrollment.id).toBe(row.id);
    expect(res.body.enrollment.status).toBe('PENDING_PAYMENT');
    expect(res.body.paymentRequired).toBe(true);
  });

  it('teacher roster lists ENROLLED only', async () => {
    const teacher = await insertTeacher(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const pendingLearner = await insertLearnerUser(ctx.db);
    const enrolledLearner = await insertLearnerUser(ctx.db);
    await insertEnrollment(
      ctx.db,
      pendingLearner.id,
      formation.id,
      'PENDING_PAYMENT',
    );
    await insertEnrollment(
      ctx.db,
      enrolledLearner.id,
      formation.id,
      'ENROLLED',
    );
    const tt = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get('/api/v1/enrollments/teacher')
      .query({ formationId: formation.id, limit: 20 })
      .set(authHeader(tt))
      .expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].student.id).toBe(enrolledLearner.id);
  });
});
