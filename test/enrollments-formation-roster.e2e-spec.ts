import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as schema from '../src/database/schema';
import {
  insertAdminUser,
  insertEnrollment,
  insertFormationWithRefs,
  insertLearnerUser,
  insertTeacher,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

function assertRosterItemHasPublicStudentOnly(row: Record<string, unknown>) {
  expect(row.student).toBeDefined();
  const s = row.student as Record<string, unknown>;
  expect(Object.keys(s).sort()).toEqual([
    'email',
    'firstName',
    'id',
    'lastName',
    'matricule',
  ]);
  expect(s).not.toHaveProperty('password');
  expect(s).not.toHaveProperty('accountType');
  expect(s).not.toHaveProperty('dob');
  expect(s).not.toHaveProperty('bacYear');
}

describe('GET /enrollments/formation/:formationId (ADMIN roster)', () => {
  let ctx: E2eContext;
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await truncateTestTables();
    ctx = await createE2eApp();
    app = ctx.app;
  });

  beforeEach(async () => {
    await truncateTestTables();
    const admin = await insertAdminUser(ctx.db);
    adminToken = await loginAsUser(app, admin.email!, 'EMAIL');
  });

  afterAll(async () => {
    await app.close();
  });

  it('ADMIN lists enrollments with structured student', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const a = await insertLearnerUser(
      ctx.db,
      `roster-a-${uniqueKey()}@test.local`,
    );
    const b = await insertLearnerUser(
      ctx.db,
      `roster-b-${uniqueKey()}@test.local`,
    );
    await insertEnrollment(ctx.db, a.id, formation.id, 'ENROLLED');
    await insertEnrollment(ctx.db, b.id, formation.id, 'ENROLLED');

    const res = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
    for (const row of res.body.data as Record<string, unknown>[]) {
      assertRosterItemHasPublicStudentOnly(row);
      const s = row.student as Record<string, unknown>;
      expect(s.id).toBeDefined();
      expect(s.firstName).toBeDefined();
      expect(s.lastName).toBeDefined();
      expect(s.email).toBeDefined();
      expect(row.studentName).toBe(
        `${s.firstName as string} ${s.lastName as string}`.trim(),
      );
    }
  });

  it('empty formation returns data [] with meta', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const res = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(10);
    expect(res.body.meta.hasNextPage).toBe(false);
    expect(res.body.meta.hasPreviousPage).toBe(false);
  });

  it('404 for unknown formation', async () => {
    await api(app)
      .get('/api/v1/enrollments/formation/00000000-0000-4000-8000-000000000099')
      .set(authHeader(adminToken))
      .expect(404);
  });

  it('403 for non-admin', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const tt = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .set(authHeader(tt))
      .expect(403);
  });

  it('401 without token', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .expect(401);
  });

  it('filters status=ENROLLED', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const u1 = await insertLearnerUser(ctx.db);
    const u2 = await insertLearnerUser(ctx.db);
    await insertEnrollment(ctx.db, u1.id, formation.id, 'ENROLLED');
    await insertEnrollment(ctx.db, u2.id, formation.id, 'CANCELLED');

    const res = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .query({ status: 'ENROLLED' })
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].status).toBe('ENROLLED');
  });

  it('filters status=PENDING_PAYMENT', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const u1 = await insertLearnerUser(ctx.db);
    const u2 = await insertLearnerUser(ctx.db);
    await insertEnrollment(ctx.db, u1.id, formation.id, 'PENDING_PAYMENT');
    await insertEnrollment(ctx.db, u2.id, formation.id, 'ENROLLED');

    const res = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .query({ status: 'PENDING_PAYMENT' })
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].status).toBe('PENDING_PAYMENT');
  });

  it('search matches firstName, lastName, email, matricule', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const hash = uniqueKey().slice(-8);
    const uSearch = await insertLearnerUser(
      ctx.db,
      `findme-${hash}@test.local`,
    );
    await ctx.db
      .update(schema.users)
      .set({
        firstName: 'Zaphod',
        lastName: 'Beeblebrox',
        matricule: `M-${hash}`,
      })
      .where(eq(schema.users.id, uSearch.id));

    const other = await insertLearnerUser(ctx.db);
    await insertEnrollment(ctx.db, uSearch.id, formation.id);
    await insertEnrollment(ctx.db, other.id, formation.id);

    for (const term of [
      'Zaphod',
      'Beeblebrox',
      `findme-${hash}`,
      `M-${hash}`,
    ]) {
      const res = await api(app)
        .get(`/api/v1/enrollments/formation/${formation.id}`)
        .query({ search: term })
        .set(authHeader(adminToken))
        .expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].studentId).toBe(uSearch.id);
    }
  });

  it('pagination meta for multi-page data', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    for (let i = 0; i < 3; i += 1) {
      const u = await insertLearnerUser(ctx.db);
      await insertEnrollment(ctx.db, u.id, formation.id);
    }

    const p1 = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .query({ limit: 2, page: 1 })
      .set(authHeader(adminToken))
      .expect(200);

    expect(p1.body.data.length).toBe(2);
    expect(p1.body.meta.total).toBe(3);
    expect(p1.body.meta.totalPages).toBe(2);
    expect(p1.body.meta.hasNextPage).toBe(true);
    expect(p1.body.meta.hasPreviousPage).toBe(false);

    const p2 = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .query({ limit: 2, page: 2 })
      .set(authHeader(adminToken))
      .expect(200);

    expect(p2.body.data.length).toBe(1);
    expect(p2.body.meta.hasNextPage).toBe(false);
    expect(p2.body.meta.hasPreviousPage).toBe(true);
  });

  it('does not leak sensitive user fields in JSON', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const u = await insertLearnerUser(ctx.db);
    await insertEnrollment(ctx.db, u.id, formation.id);

    const res = await api(app)
      .get(`/api/v1/enrollments/formation/${formation.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/"password"\s*:/);
    expect(raw).not.toMatch(/"dob"\s*:/);
    assertRosterItemHasPublicStudentOnly(
      res.body.data[0] as Record<string, unknown>,
    );
  });
});
