import { INestApplication } from '@nestjs/common';
import {
  insertAdminUser,
  insertFormationWithRefs,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('GET /formations saleStatus filter', () => {
  let ctx: E2eContext;
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    await truncateTestTables();
    ctx = await createE2eApp();
    app = ctx.app;
  });

  beforeEach(async () => {
    await truncateTestTables();
    const admin = await insertAdminUser(ctx.db);
    token = await loginAsUser(app, admin.email!, 'EMAIL');
  });

  afterAll(async () => {
    await app.close();
  });

  it('saleStatus=OPEN returns only open formations', async () => {
    const key = uniqueKey();
    const { formation: openF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS-OPEN-${key}`,
      isSaleOpen: true,
    });
    const { formation: closedF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS-CLOSED-${key}`,
      isSaleOpen: false,
    });

    const res = await api(app)
      .get('/api/v1/formations')
      .query({ page: 1, limit: 50, saleStatus: 'OPEN' })
      .set(authHeader(token))
      .expect(200);

    const ids = (res.body.data as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(openF.id);
    expect(ids).not.toContain(closedF.id);
    const openRow = (
      res.body.data as { id: string; isSaleOpen: boolean }[]
    ).find((r) => r.id === openF.id);
    expect(openRow?.isSaleOpen).toBe(true);
  });

  it('saleStatus=CLOSED returns only closed formations', async () => {
    const key = uniqueKey();
    const { formation: openF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS2-OPEN-${key}`,
      isSaleOpen: true,
    });
    const { formation: closedF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS2-CLOSED-${key}`,
      isSaleOpen: false,
    });

    const res = await api(app)
      .get('/api/v1/formations')
      .query({ saleStatus: 'CLOSED', limit: 50 })
      .set(authHeader(token))
      .expect(200);

    const ids = (res.body.data as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(closedF.id);
    expect(ids).not.toContain(openF.id);
  });

  it('saleStatus=ALL returns open and closed', async () => {
    const key = uniqueKey();
    const { formation: openF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS3-O-${key}`,
      isSaleOpen: true,
    });
    const { formation: closedF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS3-C-${key}`,
      isSaleOpen: false,
    });

    const res = await api(app)
      .get('/api/v1/formations')
      .query({
        page: 1,
        limit: 12,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        saleStatus: 'ALL',
      })
      .set(authHeader(token))
      .expect(200);

    const ids = (res.body.data as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(openF.id);
    expect(ids).toContain(closedF.id);
  });

  it('omitted saleStatus behaves like no sale filter (returns both)', async () => {
    const key = uniqueKey();
    const { formation: openF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS4-O-${key}`,
      isSaleOpen: true,
    });
    const { formation: closedF } = await insertFormationWithRefs(ctx.db, {
      title: `ZZ-SS4-C-${key}`,
      isSaleOpen: false,
    });

    const res = await api(app)
      .get('/api/v1/formations')
      .query({
        page: 1,
        limit: 12,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      .set(authHeader(token))
      .expect(200);

    const ids = (res.body.data as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(openF.id);
    expect(ids).toContain(closedF.id);
  });

  it('invalid saleStatus returns 400', async () => {
    const res = await api(app)
      .get('/api/v1/formations')
      .query({ saleStatus: 'OPEN_NOW' })
      .set(authHeader(token))
      .expect(400);

    const msg = Array.isArray(res.body.message)
      ? res.body.message.join(' ')
      : String(res.body.message ?? '');
    expect(msg.toLowerCase()).toMatch(/salestatus/);
  });
});
