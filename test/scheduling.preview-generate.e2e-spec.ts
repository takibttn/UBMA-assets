import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import {
  assignTeacherToFormation,
  insertAdminUser,
  insertFormationWithRefs,
  insertRoom,
  insertSession,
  insertTeacher,
  patchFormationDates,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables, countSessionsInDb } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';
import { FORMATION_START, MAY_2026_MONDAY_SESSIONS } from './utils/constants';

describe('Weekly slot preview / generate', () => {
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
      title: 'Preview Gen Formation',
      capacity: 25,
    });
    const room = await insertRoom(ctx.db, `PR-${uniqueKey()}`, 30);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    return { formation, room, teacher };
  }

  it('preview requires formation period', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await patchFormationDates(ctx.db, formation.id, null, null);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
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
      .expect(400);
  });

  it('preview generates May 2026 Mondays without DB writes', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    const before = await countSessionsInDb();
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
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
      .expect(200);
    expect(res.body.data.length).toBe(MAY_2026_MONDAY_SESSIONS.length);
    const starts = res.body.data.map((x: { startAt: string }) => x.startAt);
    for (const expected of MAY_2026_MONDAY_SESSIONS) {
      expect(starts).toContain(expected);
    }
    expect(res.body.summary.validCount).toBe(res.body.data.length);
    const after = await countSessionsInDb();
    expect(after).toBe(before);
  });

  it('preview counts Monday + Thursday slots', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: room.id,
          },
          {
            dayOfWeek: 4,
            startTime: '14:00',
            endTime: '16:00',
            roomId: room.id,
          },
        ],
      })
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(
      MAY_2026_MONDAY_SESSIONS.length,
    );
  });

  it('preview rejects invalid dayOfWeek', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 8,
            startTime: '09:00',
            endTime: '11:00',
            roomId: room.id,
          },
        ],
      })
      .expect(400);
  });

  it('preview rejects bad time format', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '9am',
            endTime: '11:00',
            roomId: room.id,
          },
        ],
      })
      .expect(400);
  });

  it('preview rejects startTime >= endTime and >6h slot', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '11:00',
            roomId: room.id,
          },
        ],
      })
      .expect(400);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '00:00',
            endTime: '07:01',
            roomId: room.id,
          },
        ],
      })
      .expect(400);
  });

  it('preview rejects empty weeklySlots and max 14', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({ weeklySlots: [] })
      .expect(400);
    const many: Array<{
      dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      startTime: string;
      endTime: string;
      roomId: string;
    }> = Array.from({ length: 15 }, (_, i) => ({
      dayOfWeek: ((i % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      startTime: '09:00',
      endTime: '10:00',
      roomId: room.id,
    }));
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({ weeklySlots: many })
      .expect(400);
  });

  it('preview rejects unknown room and inactive room', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: randomUUID(),
          },
        ],
      })
      .expect(404);
    const dead = await insertRoom(ctx.db, `XX-${uniqueKey()}`, 10, false);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: dead.id,
          },
        ],
      })
      .expect(400);
  });

  it('preview rejects room smaller than formation capacity', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db, {
      capacity: 50,
    });
    const small = await insertRoom(ctx.db, `SM-${uniqueKey()}`, 20);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: small.id,
          },
        ],
      })
      .expect(400);
  });

  it('preview returns 200 with CONFLICT when overlapping DB session', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date(MAY_2026_MONDAY_SESSIONS[0]),
      endAt: new Date('2026-05-04T11:00:00.000Z'),
    });
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
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
      .expect(200);
    const conflicted = res.body.data.filter(
      (x: { conflictStatus: string }) => x.conflictStatus === 'CONFLICT',
    );
    expect(conflicted.length).toBeGreaterThan(0);
    expect(res.body.summary.conflictCount).toBeGreaterThan(0);
  });

  it('preview marks internal overlap between slots', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '11:00',
            roomId: room.id,
          },
          {
            dayOfWeek: 1,
            startTime: '10:00',
            endTime: '12:00',
            roomId: room.id,
          },
        ],
      })
      .expect(200);
    expect(res.body.summary.conflictCount).toBeGreaterThan(0);
    expect(res.body.data.every((d: { tempId: string }) => d.tempId)).toBe(true);
  });

  it('generate creates sessions when no conflicts', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
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
      .expect(201);
    expect(res.body.summary.createdCount).toBe(MAY_2026_MONDAY_SESSIONS.length);
    expect(await countSessionsInDb()).toBe(MAY_2026_MONDAY_SESSIONS.length);
  });

  it('generate is transactional on conflict', async () => {
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

  it('generate applies slot title and default title', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/generate`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 4,
            startTime: '14:00',
            endTime: '16:00',
            roomId: room.id,
            title: 'Custom Thursday',
          },
        ],
      })
      .expect(201);
    const titles = res.body.created.map((c: { title: string }) => c.title);
    expect(titles.every((t: string) => t === 'Custom Thursday')).toBe(true);
    await truncateTestTables();
    const admin = await insertAdminUser(ctx.db);
    const tok = await loginAsUser(app, admin.email!, 'EMAIL');
    const { formation: f2, room: r2 } = await standardFormationRoomTeacher();
    const res2 = await api(app)
      .post(`/api/v1/formations/${f2.id}/sessions/generate`)
      .set(authHeader(tok))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 3,
            startTime: '13:00',
            endTime: '15:00',
            roomId: r2.id,
          },
        ],
      })
      .expect(201);
    expect(res2.body.created[0].title).toBe(`${f2.title} - Séance`);
  });

  it('generate skips cancelled conflicts only', async () => {
    const { formation, room } = await standardFormationRoomTeacher();
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-06T09:00:00.000Z'),
      endAt: new Date('2026-05-06T11:00:00.000Z'),
      status: 'CANCELLED',
    });
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/generate`)
      .set(authHeader(adminToken))
      .send({
        weeklySlots: [
          {
            dayOfWeek: 3,
            startTime: '09:00',
            endTime: '11:00',
            roomId: room.id,
          },
        ],
      })
      .expect(201);
  });
});
