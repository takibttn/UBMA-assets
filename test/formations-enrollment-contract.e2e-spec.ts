import { INestApplication } from '@nestjs/common';
import {
  insertAdminUser,
  insertEnrollment,
  insertFormationWithRefs,
  insertLearnerUser,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Formation / enrollment contract (price, capacity, learner state)', () => {
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

  it('GET /formations items include card fields (admin token)', async () => {
    const admin = await insertAdminUser(ctx.db);
    const key = uniqueKey();
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-CARD-${key}`,
      capacity: 12,
    });
    const token = await loginAsUser(app, admin.email!, 'EMAIL');
    const res = await api(app)
      .get('/api/v1/formations')
      .query({ limit: 20 })
      .set(authHeader(token))
      .expect(200);

    const item = (res.body.data as Record<string, unknown>[]).find(
      (x) => x.id === formation.id,
    );
    expect(item).toBeDefined();
    expect(item?.price).toBeDefined();
    expect(item?.capacity).toBe(12);
    expect(item?.enrolledCount).toBe(0);
    expect(item?.spotsRemaining).toBe(12);
    expect(item?.isSaleOpen).toBe(true);
    expect(item?.language).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        code: expect.any(String),
      }),
    );
    expect(item?.level).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        code: expect.any(String),
        name: expect.any(String),
      }),
    );
    expect(item).not.toHaveProperty('canEnroll');
  });

  it('GET /formations as APPRENANT includes canEnroll and myEnrollment', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 3,
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .get('/api/v1/formations')
      .query({ limit: 20 })
      .set(authHeader(token))
      .expect(200);

    const item = (res.body.data as Record<string, unknown>[]).find(
      (x) => x.id === formation.id,
    );
    expect(item?.canEnroll).toBe(true);
    expect(item?.myEnrollment).toBeNull();
  });

  it('GET /formations/:id matches list richness', async () => {
    const admin = await insertAdminUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 7,
    });
    const token = await loginAsUser(app, admin.email!, 'EMAIL');
    const res = await api(app)
      .get(`/api/v1/formations/${formation.id}`)
      .set(authHeader(token))
      .expect(200);

    expect(res.body.enrolledCount).toBe(0);
    expect(res.body.spotsRemaining).toBe(7);
    expect(res.body.price).toBeDefined();
    expect(res.body.language?.id).toBeDefined();
    expect(res.body.level?.id).toBeDefined();
  });

  it('POST /enrollments returns nested formation and duplicate returns 409', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 5,
      isSaleOpen: true,
    });
    const token = await loginAsUser(app, learner.email!, 'EMAIL');
    const res = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(201);

    expect(res.body.enrollment).toBeDefined();
    expect(res.body.enrollment.formation).toBeDefined();
    expect(res.body.paymentRequired).toBe(false);
    expect(res.body.enrollment.formation.enrolledCount).toBe(1);
    expect(res.body.enrollment.formation.spotsRemaining).toBe(4);
    expect(typeof res.body.enrollment.enrolledAt).toBe('string');

    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: formation.id })
      .expect(409);
  });

  it('POST /enrollments returns 400 when sale closed or full', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const token = await loginAsUser(app, learner.email!, 'EMAIL');

    const { formation: closed } = await insertFormationWithRefs(ctx.db, {
      isSaleOpen: false,
    });
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: closed.id })
      .expect(400);

    const { formation: fullF } = await insertFormationWithRefs(ctx.db, {
      capacity: 1,
      isSaleOpen: true,
    });
    const other = await insertLearnerUser(ctx.db);
    await insertEnrollment(ctx.db, other.id, fullF.id, 'ENROLLED');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(token))
      .send({ formationId: fullF.id })
      .expect(400);
  });
});
