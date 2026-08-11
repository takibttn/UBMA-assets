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
import { FORMATION_START } from './utils/constants';

describe('Admin room scheduling', () => {
  let ctx: E2eContext;
  let app: INestApplication;
  let adminToken: string;
  let adminEmail: string;

  beforeAll(async () => {
    await truncateTestTables();
    ctx = await createE2eApp();
    app = ctx.app;
  });

  beforeEach(async () => {
    await truncateTestTables();
    adminEmail = `adm-${uniqueKey()}@test.local`;
    const admin = await insertAdminUser(ctx.db, adminEmail);
    adminToken = await loginAsUser(app, admin.email!, 'EMAIL');
    void admin;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a room', async () => {
    const code = `SALLE-${uniqueKey().slice(-6)}`;
    const res = await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(adminToken))
      .send({
        code,
        name: 'Salle 01',
        capacity: 25,
      })
      .expect(201);
    expect(res.body.code).toBe(code.toUpperCase());
    expect(res.body.name).toBe('Salle 01');
    expect(res.body.capacity).toBe(25);
    expect(res.body.isActive).toBe(true);
  });

  it('rejects duplicate room code', async () => {
    const code = `DUP-${uniqueKey().slice(-6)}`;
    await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(adminToken))
      .send({ code, name: 'A', capacity: 10 })
      .expect(201);
    await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(adminToken))
      .send({ code, name: 'B', capacity: 15 })
      .expect(409);
  });

  it('rejects capacity below 1', async () => {
    await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(adminToken))
      .send({ code: `X-${uniqueKey()}`, name: 'X', capacity: 0 })
      .expect(400);
  });

  it('searches rooms by code fragment', async () => {
    await insertRoom(ctx.db, `SALLE-${uniqueKey().slice(-4)}`, 20);
    const labCode = `LAB-${uniqueKey().slice(-4)}`;
    await insertRoom(ctx.db, labCode, 15);
    const res = await api(app)
      .get('/api/v1/rooms')
      .query({ search: labCode.slice(0, 6), limit: 100 })
      .set(authHeader(adminToken))
      .expect(200);
    const codes = res.body.data.map((r: { code: string }) => r.code);
    expect(codes).toContain(labCode.toUpperCase());
  });

  it('filters active rooms', async () => {
    await insertRoom(ctx.db, `ON-${uniqueKey()}`, 10, true);
    const inactive = await insertRoom(ctx.db, `OFF-${uniqueKey()}`, 10, false);
    const res = await api(app)
      .get('/api/v1/rooms')
      .query({ isActive: true, limit: 100 })
      .set(authHeader(adminToken))
      .expect(200);
    const codes = res.body.data.map((r: { code: string }) => r.code);
    expect(codes).not.toContain(inactive.code);
  });

  it('updates room fields', async () => {
    const r = await insertRoom(ctx.db, `UP-${uniqueKey()}`, 12);
    const res = await api(app)
      .patch(`/api/v1/rooms/${r.id}`)
      .set(authHeader(adminToken))
      .send({ name: 'Updated', capacity: 44, isActive: false })
      .expect(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.capacity).toBe(44);
    expect(res.body.isActive).toBe(false);
  });

  it('cannot delete room referenced by sessions', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `DEL-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date(FORMATION_START),
      endAt: new Date('2026-05-01T02:00:00.000Z'),
    });
    await api(app)
      .delete(`/api/v1/rooms/${room.id}`)
      .set(authHeader(adminToken))
      .expect(400);
  });

  it('ENSEIGNANT cannot POST rooms', async () => {
    const t = await insertTeacher(ctx.db);
    const tTok = await loginAsUser(app, t.email, 'TEACHER');
    await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(tTok))
      .send({ code: `T-${uniqueKey()}`, name: 'N', capacity: 5 })
      .expect(403);
  });

  it('APPRENANT cannot POST rooms', async () => {
    const u = await insertLearnerUser(ctx.db);
    const tok = await loginAsUser(app, u.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(tok))
      .send({ code: `L-${uniqueKey()}`, name: 'N', capacity: 5 })
      .expect(403);
  });
});
