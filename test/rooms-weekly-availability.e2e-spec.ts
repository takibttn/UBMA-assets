import { INestApplication } from '@nestjs/common';
import {
  insertAdminUser,
  insertFormationWithRefs,
  insertLearnerUser,
  insertRoom,
  insertSession,
  insertTeacher,
  patchFormationDates,
  uniqueKey,
} from './utils/factories';
import { FORMATION_END, FORMATION_START } from './utils/constants';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Room weekly availability (admin UX helper)', () => {
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

  function availBody(
    formationId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      formationId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '11:00',
      ...overrides,
    };
  }

  it('ADMIN: room AVAILABLE when no sessions', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `AV-${uniqueKey()}`, 40);
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('AVAILABLE');
    expect(row?.conflictCount).toBe(0);
    expect(row?.conflicts).toEqual([]);
    expect(res.body.summary).toMatchObject({
      totalRooms: res.body.data.length,
      availableCount: expect.any(Number),
    });
  });

  it('returns OCCUPIED when session overlaps a generated candidate', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `OC-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-11T10:00:00.000Z'),
      endAt: new Date('2026-05-11T12:00:00.000Z'),
    });
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('OCCUPIED');
    expect(row?.conflictCount).toBe(1);
    expect(row?.conflicts[0]?.sessionTitle).toBeDefined();
    expect(row?.conflicts[0]?.formationTitle).toBeDefined();
  });

  it('allows back-to-back sessions (09:00–11:00 vs 11:00–13:00)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `BB-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-11T11:00:00.000Z'),
      endAt: new Date('2026-05-11T13:00:00.000Z'),
    });
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('AVAILABLE');
  });

  it('ignores CANCELLED overlapping sessions', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `CA-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-11T10:00:00.000Z'),
      endAt: new Date('2026-05-11T12:00:00.000Z'),
      status: 'CANCELLED',
    });
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('AVAILABLE');
  });

  it('returns INSUFFICIENT_CAPACITY when room smaller than formation', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 30,
    });
    const room = await insertRoom(ctx.db, `SM-${uniqueKey()}`, 20);
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('INSUFFICIENT_CAPACITY');
  });

  it('returns INACTIVE for inactive room', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `IN-${uniqueKey()}`, 40, false);
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('INACTIVE');
  });

  it('returns 400 when formation has no period', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await patchFormationDates(ctx.db, formation.id, null, null);
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(400);
    expect(res.body.message).toContain('startDate and endDate');
  });

  it('returns 400 for invalid dayOfWeek', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id, { dayOfWeek: 0 }))
      .expect(400);
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id, { dayOfWeek: 8 }))
      .expect(400);
  });

  it('returns 400 for invalid time format', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id, { startTime: '9am' }))
      .expect(400);
  });

  it('returns 400 when startTime >= endTime', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id, { startTime: '11:00', endTime: '09:00' }))
      .expect(400);
  });

  it('returns 400 when duration exceeds 6 hours', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id, { startTime: '08:00', endTime: '16:00' }))
      .expect(400);
  });

  it('ENSEIGNANT and APPRENANT get 403', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const tt = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(tt))
      .send(availBody(formation.id))
      .expect(403);
    const learner = await insertLearnerUser(ctx.db);
    const lt = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(lt))
      .send(availBody(formation.id))
      .expect(403);
  });

  it('returns 404 when formation not found', async () => {
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send({
        formationId: '00000000-0000-4000-8000-000000000099',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '11:00',
      })
      .expect(404);
  });

  it('returns 401 without token', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .send(availBody(formation.id))
      .expect(401);
  });

  it('marks OCCUPIED if only a later Monday conflicts (whole period check)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `LT-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-18T10:00:00.000Z'),
      endAt: new Date('2026-05-18T12:00:00.000Z'),
    });
    const res = await api(app)
      .post('/api/v1/rooms/availability-for-weekly-slot')
      .set(authHeader(adminToken))
      .send(availBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('OCCUPIED');
    expect(row?.conflictCount).toBe(1);
  });
});

describe('Preview slotIndex is 0-based', () => {
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

  it('maps weeklySlots[0] to slotIndex 0 and weeklySlots[1] to slotIndex 1', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
      startDate: new Date(FORMATION_START),
      endDate: new Date(FORMATION_END),
    });
    const roomA = await insertRoom(ctx.db, `PA-${uniqueKey()}`, 40);
    const roomB = await insertRoom(ctx.db, `PB-${uniqueKey()}`, 40);

    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: roomA.id,
          },
          {
            dayOfWeek: 2,
            startTime: '14:00',
            endTime: '16:00',
            roomId: roomB.id,
          },
        ],
      })
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    const tue = res.body.data.filter(
      (r: { dayOfWeek: number }) => r.dayOfWeek === 2,
    );
    const mon = res.body.data.filter(
      (r: { dayOfWeek: number }) => r.dayOfWeek === 1,
    );
    expect(mon.length).toBeGreaterThan(0);
    expect(tue.length).toBeGreaterThan(0);
    for (const row of res.body.data) {
      if (row.dayOfWeek === 1) {
        expect(row.slotIndex).toBe(0);
      }
      if (row.dayOfWeek === 2) {
        expect(row.slotIndex).toBe(1);
      }
    }
  });
});
