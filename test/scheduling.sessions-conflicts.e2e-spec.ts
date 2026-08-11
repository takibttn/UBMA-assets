import { INestApplication } from '@nestjs/common';
import {
  assignTeacherToFormation,
  insertAdminUser,
  insertFormationWithRefs,
  insertRoom,
  insertSession,
  insertTeacher,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Schedule conflicts — manual CRUD', () => {
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

  it('blocks room overlap', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 40);
    const t = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, t.id);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-05T09:00:00.000Z',
        endAt: '2026-05-05T11:00:00.000Z',
      })
      .expect(201);
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-05T10:00:00.000Z',
        endAt: '2026-05-05T12:00:00.000Z',
      })
      .expect(409);
    expect(res.body.message).toMatch(/conflict/i);
    expect(res.body.roomConflicts?.length).toBeGreaterThan(0);
  });

  it('allows back-to-back same room', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 40);
    const t = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, t.id);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-06T09:00:00.000Z',
        endAt: '2026-05-06T11:00:00.000Z',
      })
      .expect(201);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-06T11:00:00.000Z',
        endAt: '2026-05-06T13:00:00.000Z',
      })
      .expect(201);
  });

  it('blocks same formation overlap different room', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const r1 = await insertRoom(ctx.db, `A-${uniqueKey()}`, 40);
    const r2 = await insertRoom(ctx.db, `B-${uniqueKey()}`, 40);
    const t = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, t.id);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: r1.id,
        startAt: '2026-05-07T09:00:00.000Z',
        endAt: '2026-05-07T11:00:00.000Z',
      })
      .expect(201);
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: r2.id,
        startAt: '2026-05-07T10:00:00.000Z',
        endAt: '2026-05-07T12:00:00.000Z',
      })
      .expect(409);
    expect(res.body.formationConflicts?.length).toBeGreaterThan(0);
  });

  it('blocks teacher conflict across formations', async () => {
    const seedA = await insertFormationWithRefs(ctx.db, { title: 'FA' });
    const seedB = await insertFormationWithRefs(ctx.db, { title: 'FB' });
    const roomA = await insertRoom(ctx.db, `RA-${uniqueKey()}`, 40);
    const roomB = await insertRoom(ctx.db, `RB-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, seedA.formation.id, teacher.id);
    await assignTeacherToFormation(ctx.db, seedB.formation.id, teacher.id);
    await api(app)
      .post(`/api/v1/formations/${seedA.formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: roomA.id,
        startAt: '2026-05-08T09:00:00.000Z',
        endAt: '2026-05-08T11:00:00.000Z',
      })
      .expect(201);
    const res = await api(app)
      .post(`/api/v1/formations/${seedB.formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: roomB.id,
        startAt: '2026-05-08T10:00:00.000Z',
        endAt: '2026-05-08T12:00:00.000Z',
      })
      .expect(409);
    expect(res.body.teacherConflicts?.length).toBeGreaterThan(0);
  });

  it('allows same time different formation different teacher', async () => {
    const seedA = await insertFormationWithRefs(ctx.db);
    const seedB = await insertFormationWithRefs(ctx.db);
    const roomA = await insertRoom(ctx.db, `RA-${uniqueKey()}`, 40);
    const roomB = await insertRoom(ctx.db, `RB-${uniqueKey()}`, 40);
    const t1 = await insertTeacher(ctx.db);
    const t2 = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, seedA.formation.id, t1.id);
    await assignTeacherToFormation(ctx.db, seedB.formation.id, t2.id);
    await api(app)
      .post(`/api/v1/formations/${seedA.formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: roomA.id,
        startAt: '2026-05-09T09:00:00.000Z',
        endAt: '2026-05-09T11:00:00.000Z',
      })
      .expect(201);
    await api(app)
      .post(`/api/v1/formations/${seedB.formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: roomB.id,
        startAt: '2026-05-09T09:00:00.000Z',
        endAt: '2026-05-09T11:00:00.000Z',
      })
      .expect(201);
  });

  it('ignores CANCELLED session for conflict', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 40);
    const t = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, t.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-10T09:00:00.000Z'),
      endAt: new Date('2026-05-10T11:00:00.000Z'),
      status: 'CANCELLED',
    });
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T11:00:00.000Z',
      })
      .expect(201);
  });

  it('PATCH exclude self; PATCH into overlap blocked', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 40);
    const t = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, t.id);
    const a = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-11T09:00:00.000Z',
        endAt: '2026-05-11T11:00:00.000Z',
      })
      .expect(201);
    const b = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-11T13:00:00.000Z',
        endAt: '2026-05-11T15:00:00.000Z',
      })
      .expect(201);
    await api(app)
      .patch(`/api/v1/formations/${formation.id}/sessions/${a.body.id}`)
      .set(authHeader(adminToken))
      .send({
        startAt: '2026-05-11T09:00:00.000Z',
        endAt: '2026-05-11T11:00:00.000Z',
      })
      .expect(200);
    await api(app)
      .patch(`/api/v1/formations/${formation.id}/sessions/${b.body.id}`)
      .set(authHeader(adminToken))
      .send({
        startAt: '2026-05-11T10:00:00.000Z',
        endAt: '2026-05-11T14:00:00.000Z',
      })
      .expect(409);
  });
});
