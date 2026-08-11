import { INestApplication } from '@nestjs/common';
import {
  assignTeacherToFormation,
  insertAdminUser,
  insertFormationWithRefs,
  insertTeacher,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Formations assigned-teacher fields', () => {
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

  it('GET /formations list: isTeacherAssigned=false and assignedTeacher=null when no teacher', async () => {
    const key = uniqueKey();
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: `F-NOTEACHER-${key}`,
    });

    const res = await api(app)
      .get('/api/v1/formations')
      .query({ page: 1, limit: 50 })
      .set(authHeader(adminToken))
      .expect(200);

    const row = (res.body.data as { id: string }[]).find(
      (r) => r.id === formation.id,
    ) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.isTeacherAssigned).toBe(false);
    expect(row.assignedTeacher).toBeNull();
  });

  it('GET /formations list: isTeacherAssigned=true and assignedTeacher has id, firstName, lastName, email when assigned', async () => {
    const key = uniqueKey();
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: `F-ASSIGNED-${key}`,
    });
    const teacher = await insertTeacher(
      ctx.db,
      `teacher-assigned-${key}@test.local`,
    );
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);

    const res = await api(app)
      .get('/api/v1/formations')
      .query({ page: 1, limit: 50 })
      .set(authHeader(adminToken))
      .expect(200);

    const row = (res.body.data as { id: string }[]).find(
      (r) => r.id === formation.id,
    ) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.isTeacherAssigned).toBe(true);
    const t = row.assignedTeacher as Record<string, unknown>;
    expect(t.id).toBe(teacher.id);
    expect(t.firstName).toBe(teacher.firstName);
    expect(t.lastName).toBe(teacher.lastName);
    expect(t.email).toBe(teacher.email);
    expect(t).not.toHaveProperty('password');
  });

  it('GET /formations/:id: isTeacherAssigned=false and assignedTeacher=null when no teacher', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);

    const res = await api(app)
      .get(`/api/v1/formations/${formation.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body.isTeacherAssigned).toBe(false);
    expect(res.body.assignedTeacher).toBeNull();
  });

  it('GET /formations/:id: isTeacherAssigned=true with teacher details when assigned', async () => {
    const key = uniqueKey();
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: `F-DET-${key}`,
    });
    const teacher = await insertTeacher(ctx.db, `t-det-${key}@test.local`);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);

    const res = await api(app)
      .get(`/api/v1/formations/${formation.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body.isTeacherAssigned).toBe(true);
    const t = res.body.assignedTeacher as Record<string, unknown>;
    expect(t.id).toBe(teacher.id);
    expect(t.firstName).toBe(teacher.firstName);
    expect(t.lastName).toBe(teacher.lastName);
    expect(t.email).toBe(teacher.email);
    expect(t).not.toHaveProperty('password');
  });

  it('assignedTeacher.id is a valid UUID', async () => {
    const key = uniqueKey();
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: `F-UUID-${key}`,
    });
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);

    const res = await api(app)
      .get(`/api/v1/formations/${formation.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    const t = res.body.assignedTeacher as Record<string, unknown>;
    expect(typeof t.id).toBe('string');
    expect(t.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
