import { INestApplication } from '@nestjs/common';
import {
  assignTeacherToFormation,
  insertAdminUser,
  insertEnrollment,
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

describe('Teacher calendar and formation-scoped sessions', () => {
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

  it('calendar returns SESSION events with room and sort by startAt', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: 'CalFormation',
    });
    const room = await insertRoom(ctx.db, `CAL-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-20T15:00:00.000Z'),
      endAt: new Date('2026-05-20T17:00:00.000Z'),
    });
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-20T09:00:00.000Z'),
      endAt: new Date('2026-05-20T11:00:00.000Z'),
    });
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get('/api/v1/teachers/me/calendar')
      .set(authHeader(tTok))
      .expect(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].type).toBe('SESSION');
    expect(
      res.body.data.every((e: { type: string }) => e.type === 'SESSION'),
    ).toBe(true);
    expect(new Date(res.body.data[0].startsAt).getTime()).toBeLessThan(
      new Date(res.body.data[1].startsAt).getTime(),
    );
    expect(res.body.data[0].room.code).toBeDefined();
  });

  it('calendar excludes unassigned formation sessions', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `OR-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const other = await insertFormationWithRefs(ctx.db);
    await insertSession(ctx.db, {
      formationId: other.formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-21T09:00:00.000Z'),
      endAt: new Date('2026-05-21T11:00:00.000Z'),
    });
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get('/api/v1/teachers/me/calendar')
      .set(authHeader(tTok))
      .expect(200);
    expect(res.body.data.length).toBe(0);
  });

  it('calendar from/to filters sessions', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `FT-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-22T09:00:00.000Z'),
      endAt: new Date('2026-05-22T11:00:00.000Z'),
    });
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-06-22T09:00:00.000Z'),
      endAt: new Date('2026-06-22T11:00:00.000Z'),
    });
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get('/api/v1/teachers/me/calendar')
      .query({ from: '2026-05-01', to: '2026-05-31' })
      .set(authHeader(tTok))
      .expect(200);
    expect(res.body.data.length).toBe(1);
  });

  it('calendar search matches session title and room code', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: 'AlphaLang',
    });
    const room = await insertRoom(
      ctx.db,
      `ROOMXYZ-${uniqueKey().slice(-4)}`,
      40,
    );
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-23T09:00:00.000Z'),
      endAt: new Date('2026-05-23T11:00:00.000Z'),
      title: 'SpecialSeanceTitle',
    });
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const byTitle = await api(app)
      .get('/api/v1/teachers/me/calendar')
      .query({ search: 'SpecialSeance' })
      .set(authHeader(tTok))
      .expect(200);
    expect(byTitle.body.data.length).toBe(1);
    const byRoom = await api(app)
      .get('/api/v1/teachers/me/calendar')
      .query({ search: 'ROOMXYZ' })
      .set(authHeader(tTok))
      .expect(200);
    expect(byRoom.body.data.length).toBe(1);
  });

  it('me/formations includes nextSession skipping CANCELLED', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `NX-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-24T08:00:00.000Z'),
      endAt: new Date('2026-05-24T09:00:00.000Z'),
      status: 'CANCELLED',
    });
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-24T12:00:00.000Z'),
      endAt: new Date('2026-05-24T14:00:00.000Z'),
    });
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get('/api/v1/teachers/me/formations')
      .query({ limit: 50 })
      .set(authHeader(tTok))
      .expect(200);
    const row = res.body.data.find(
      (f: { id: string }) => f.id === formation.id,
    );
    expect(row?.nextSession).toBeDefined();
    expect(row.nextSession.startAt).toContain('2026-05-24T12:00:00');
  });

  it('formation-scoped sessions only for that formation', async () => {
    const a = await insertFormationWithRefs(ctx.db, { title: 'FA' });
    const b = await insertFormationWithRefs(ctx.db, { title: 'FB' });
    const r = await insertRoom(ctx.db, `M-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, a.formation.id, teacher.id);
    await assignTeacherToFormation(ctx.db, b.formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: a.formation.id,
      roomId: r.id,
      startAt: new Date('2026-05-25T09:00:00.000Z'),
      endAt: new Date('2026-05-25T11:00:00.000Z'),
    });
    await insertSession(ctx.db, {
      formationId: b.formation.id,
      roomId: r.id,
      startAt: new Date('2026-05-26T09:00:00.000Z'),
      endAt: new Date('2026-05-26T11:00:00.000Z'),
    });
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get(`/api/v1/teachers/me/formations/${a.formation.id}/sessions`)
      .set(authHeader(tTok))
      .expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].formationId).toBe(a.formation.id);
  });

  it('rejects formation sessions when not assigned', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const tTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/sessions`)
      .set(authHeader(tTok))
      .expect(403);
  });

  it('APPRENANT cannot access teacher calendar', async () => {
    const u = await insertLearnerUser(ctx.db);
    const tok = await loginAsUser(app, u.email!, 'EMAIL');
    await api(app)
      .get('/api/v1/teachers/me/calendar')
      .set(authHeader(tok))
      .expect(403);
  });

  it('ADMIN cannot access teachers me calendar', async () => {
    await api(app)
      .get('/api/v1/teachers/me/calendar')
      .set(authHeader(adminToken))
      .expect(403);
  });
});
