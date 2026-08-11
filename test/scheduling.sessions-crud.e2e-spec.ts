import { INestApplication } from '@nestjs/common';
import {
  assignTeacherToFormation,
  insertAdminUser,
  insertFormationWithRefs,
  insertLearnerUser,
  insertRoom,
  insertSession,
  insertTeacher,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';
import { FORMATION_END, FORMATION_START } from './utils/constants';

describe('Manual formation sessions CRUD', () => {
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

  async function baseSetup() {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: 'Anglais A2 Test',
      capacity: 30,
    });
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    return { formation, room, teacher };
  }

  it('ADMIN creates session inside formation period', async () => {
    const { formation, room } = await baseSetup();
    const startAt = '2026-05-05T09:00:00.000Z';
    const endAt = '2026-05-05T11:00:00.000Z';
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt,
        endAt,
        title: 'Custom',
      })
      .expect(201);
    expect(res.body.title).toBe('Custom');
    expect(res.body.room.id).toBe(room.id);
    expect(res.body.formation.id).toBe(formation.id);
    expect(typeof res.body.enrolledCount).toBe('number');
  });

  it('defaults title when omitted', async () => {
    const { formation, room } = await baseSetup();
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-06T09:00:00.000Z',
        endAt: '2026-05-06T11:00:00.000Z',
      })
      .expect(201);
    expect(res.body.title).toBe(`${formation.title} - Séance`);
  });

  it('rejects session outside formation period', async () => {
    const { formation, room } = await baseSetup();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-04-01T09:00:00.000Z',
        endAt: '2026-04-01T11:00:00.000Z',
      })
      .expect(400);
  });

  it('rejects startAt >= endAt', async () => {
    const { formation, room } = await baseSetup();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-07T11:00:00.000Z',
        endAt: '2026-05-07T09:00:00.000Z',
      })
      .expect(400);
  });

  it('rejects duration over 6 hours', async () => {
    const { formation, room } = await baseSetup();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-08T09:00:00.000Z',
        endAt: '2026-05-08T16:00:01.000Z',
      })
      .expect(400);
  });

  it('rejects inactive room', async () => {
    const { formation } = await baseSetup();
    const room = await insertRoom(ctx.db, `IN-${uniqueKey()}`, 20, false);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-09T09:00:00.000Z',
        endAt: '2026-05-09T11:00:00.000Z',
      })
      .expect(400);
  });

  it('rejects room smaller than formation capacity', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 30,
    });
    const small = await insertRoom(ctx.db, `SM-${uniqueKey()}`, 20);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: small.id,
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T11:00:00.000Z',
      })
      .expect(400);
  });

  it('lists sessions ordered by startAt', async () => {
    const { formation, room } = await baseSetup();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-12T13:00:00.000Z',
        endAt: '2026-05-12T15:00:00.000Z',
      })
      .expect(201);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-12T09:00:00.000Z',
        endAt: '2026-05-12T11:00:00.000Z',
      })
      .expect(201);
    const res = await api(app)
      .get(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.body.length).toBe(2);
    expect(new Date(res.body[0].startAt).getTime()).toBeLessThan(
      new Date(res.body[1].startAt).getTime(),
    );
  });

  it('updates and deletes session', async () => {
    const { formation, room } = await baseSetup();
    const created = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-14T09:00:00.000Z',
        endAt: '2026-05-14T11:00:00.000Z',
      })
      .expect(201);
    const sid = created.body.id;
    await api(app)
      .patch(`/api/v1/formations/${formation.id}/sessions/${sid}`)
      .set(authHeader(adminToken))
      .send({ status: 'CANCELLED' })
      .expect(200);
    const g = await api(app)
      .get(`/api/v1/formations/${formation.id}/sessions/${sid}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(g.body.status).toBe('CANCELLED');
    await api(app)
      .delete(`/api/v1/formations/${formation.id}/sessions/${sid}`)
      .set(authHeader(adminToken))
      .expect(204);
  });

  it('teacher and learner cannot create sessions', async () => {
    const { formation, room, teacher } = await baseSetup();
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(tTok))
      .send({
        roomId: room.id,
        startAt: '2026-05-15T09:00:00.000Z',
        endAt: '2026-05-15T11:00:00.000Z',
      })
      .expect(403);
    const u = await insertLearnerUser(ctx.db);
    const uTok = await loginAsUser(app, u.email!, 'EMAIL');
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(uTok))
      .send({
        roomId: room.id,
        startAt: '2026-05-16T09:00:00.000Z',
        endAt: '2026-05-16T11:00:00.000Z',
      })
      .expect(403);
  });
});
