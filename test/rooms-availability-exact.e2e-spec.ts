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
import {
  FORMATION_END,
  FORMATION_START,
  MAY_2026_MONDAY_SESSIONS,
} from './utils/constants';
import { truncateTestTables, countSessionsInDb } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('POST /rooms/availability (exact interval, ADMIN)', () => {
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

  function exactBody(
    formationId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      formationId,
      startAt: '2026-05-11T09:00:00.000Z',
      endAt: '2026-05-11T11:00:00.000Z',
      ...overrides,
    };
  }

  it('ACTIVE room, capacity ok, no overlap → AVAILABLE', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `AV-${uniqueKey()}`, 40);
    const res = await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(exactBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('AVAILABLE');
    expect(row?.conflictCount).toBe(0);
    expect(row?.conflicts).toEqual([]);
    expect(res.body.summary.totalRooms).toBe(res.body.data.length);
    expect(res.body.summary.availableCount).toBeGreaterThanOrEqual(1);
  });

  it('OCCUPIED with conflict details when sessions overlap', async () => {
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
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(exactBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('OCCUPIED');
    expect(row?.conflictCount).toBe(1);
    expect(row?.conflicts[0]?.sessionId).toBeDefined();
    expect(row?.conflicts[0]?.formationId).toBe(formation.id);
  });

  it('allows back-to-back (existing 09:00–11:00, request 11:00–13:00)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `BB-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-11T09:00:00.000Z'),
      endAt: new Date('2026-05-11T11:00:00.000Z'),
    });
    const res = await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(
        exactBody(formation.id, {
          startAt: '2026-05-11T11:00:00.000Z',
          endAt: '2026-05-11T13:00:00.000Z',
        }),
      )
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
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(exactBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('AVAILABLE');
  });

  it('INSUFFICIENT_CAPACITY when room smaller than formation', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 30,
    });
    const room = await insertRoom(ctx.db, `SM-${uniqueKey()}`, 20);
    const res = await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(exactBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('INSUFFICIENT_CAPACITY');
  });

  it('INACTIVE when room isActive false', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `NA-${uniqueKey()}`, 40, false);
    const res = await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(exactBody(formation.id))
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('INACTIVE');
  });

  it('availableOnly returns only AVAILABLE rooms', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const occupiedRoom = await insertRoom(ctx.db, `O-${uniqueKey()}`, 40);
    const freeRoom = await insertRoom(ctx.db, `F-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: occupiedRoom.id,
      startAt: new Date('2026-05-11T10:00:00.000Z'),
      endAt: new Date('2026-05-11T12:00:00.000Z'),
    });
    const res = await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(
        exactBody(formation.id, {
          availableOnly: true,
        }),
      )
      .expect(200);
    expect(
      res.body.data.every((r: { status: string }) => r.status === 'AVAILABLE'),
    ).toBe(true);
    const ids = res.body.data.map((r: { room: { id: string } }) => r.room.id);
    expect(ids).toContain(freeRoom.id);
    expect(ids).not.toContain(occupiedRoom.id);
    expect(res.body.summary.availableCount).toBe(res.body.data.length);
    expect(res.body.summary.occupiedCount).toBe(0);
  });

  it('excludeSessionId: editing session does not conflict with itself', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 20,
    });
    const room = await insertRoom(ctx.db, `EX-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const created = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions`)
      .set(authHeader(adminToken))
      .send({
        roomId: room.id,
        startAt: '2026-05-12T09:00:00.000Z',
        endAt: '2026-05-12T11:00:00.000Z',
      })
      .expect(201);
    const sessionId = created.body.id as string;
    const res = await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(
        exactBody(formation.id, {
          startAt: '2026-05-12T09:00:00.000Z',
          endAt: '2026-05-12T11:00:00.000Z',
          excludeSessionId: sessionId,
        }),
      )
      .expect(200);
    const row = res.body.data.find(
      (r: { room: { id: string } }) => r.room.id === room.id,
    );
    expect(row?.status).toBe('AVAILABLE');
  });

  it('400 when startAt >= endAt', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(
        exactBody(formation.id, {
          startAt: '2026-05-11T12:00:00.000Z',
          endAt: '2026-05-11T11:00:00.000Z',
        }),
      )
      .expect(400);
  });

  it('400 when session outside formation period (both dates set)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      startDate: new Date(FORMATION_START),
      endDate: new Date(FORMATION_END),
    });
    await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(adminToken))
      .send(
        exactBody(formation.id, {
          startAt: '2026-06-15T09:00:00.000Z',
          endAt: '2026-06-15T11:00:00.000Z',
        }),
      )
      .expect(400);
  });

  it('403 for ENSEIGNANT and APPRENANT', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const tt = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(tt))
      .send(exactBody(formation.id))
      .expect(403);
    const learner = await insertLearnerUser(ctx.db);
    const lt = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/rooms/availability')
      .set(authHeader(lt))
      .send(exactBody(formation.id))
      .expect(403);
  });

  it('401 without token', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post('/api/v1/rooms/availability')
      .send(exactBody(formation.id))
      .expect(401);
  });
});

describe('Regression: CRUD / generate still 409 on room conflict', () => {
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

  async function standardFormationRoomTeacher() {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      title: 'Avail Regression F',
      capacity: 25,
    });
    const room = await insertRoom(ctx.db, `RG-${uniqueKey()}`, 30);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    return { formation, room, teacher };
  }

  it('POST session still 409 when room occupied', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
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
    expect(res.body.roomConflicts?.length).toBeGreaterThan(0);
  });

  it('PATCH session still 409 when moving into occupied slot', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await api(app)
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
    const res = await api(app)
      .patch(`/api/v1/formations/${formation.id}/sessions/${b.body.id}`)
      .set(authHeader(adminToken))
      .send({
        startAt: '2026-05-11T10:00:00.000Z',
        endAt: '2026-05-11T14:00:00.000Z',
      })
      .expect(409);
    expect(res.body.roomConflicts?.length).toBeGreaterThan(0);
  });

  it('generate still 409 when weekly slot conflicts with DB session', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date(MAY_2026_MONDAY_SESSIONS[0]),
      endAt: new Date('2026-05-04T11:00:00.000Z'),
    });
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/generate`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: room.id,
          },
        ],
      })
      .expect(409);
    expect(res.body.candidateConflicts).toBeDefined();
    expect(await countSessionsInDb()).toBe(1);
  });
});
