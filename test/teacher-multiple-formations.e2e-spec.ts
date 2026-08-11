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

describe('Teacher Multiple Formations Validation', () => {
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

  it('allows assigning a teacher to two formations if sessions do not overlap', async () => {
    const teacher = await insertTeacher(ctx.db);
    const room = await insertRoom(ctx.db);

    const fA = await insertFormationWithRefs(ctx.db, { title: 'Formation A' });
    const fB = await insertFormationWithRefs(ctx.db, { title: 'Formation B' });

    // Add session to Formation A
    await insertSession(ctx.db, {
      formationId: fA.formation.id,
      roomId: room.id,
      startAt: new Date('2026-06-01T08:00:00.000Z'),
      endAt: new Date('2026-06-01T10:00:00.000Z'),
    });

    // Add non-overlapping session to Formation B
    await insertSession(ctx.db, {
      formationId: fB.formation.id,
      roomId: room.id,
      startAt: new Date('2026-06-01T10:30:00.000Z'),
      endAt: new Date('2026-06-01T12:30:00.000Z'),
    });

    // Assign to A
    await api(app)
      .post(`/api/v1/teachers/${teacher.id}/formations/${fA.formation.id}`)
      .set(authHeader(adminToken))
      .expect(201);

    // Assign to B (Should work now, whereas before it would block based on date range)
    await api(app)
      .post(`/api/v1/teachers/${teacher.id}/formations/${fB.formation.id}`)
      .set(authHeader(adminToken))
      .expect(201);
  });

  it('blocks assigning a teacher to a second formation if a session overlaps', async () => {
    const teacher = await insertTeacher(ctx.db);
    const room = await insertRoom(ctx.db);

    const fA = await insertFormationWithRefs(ctx.db, { title: 'Formation A' });
    const fB = await insertFormationWithRefs(ctx.db, { title: 'Formation B' });

    // Add session to Formation A
    await insertSession(ctx.db, {
      formationId: fA.formation.id,
      roomId: room.id,
      startAt: new Date('2026-06-01T08:00:00.000Z'),
      endAt: new Date('2026-06-01T10:00:00.000Z'),
    });

    // Add OVERLAPPING session to Formation B
    await insertSession(ctx.db, {
      formationId: fB.formation.id,
      roomId: room.id,
      startAt: new Date('2026-06-01T09:00:00.000Z'),
      endAt: new Date('2026-06-01T11:00:00.000Z'),
    });

    // Assign to A
    await api(app)
      .post(`/api/v1/teachers/${teacher.id}/formations/${fA.formation.id}`)
      .set(authHeader(adminToken))
      .expect(201);

    // Assign to B (Should FAIL due to session overlap)
    const res = await api(app)
      .post(`/api/v1/teachers/${teacher.id}/formations/${fB.formation.id}`)
      .set(authHeader(adminToken))
      .expect(409);

    expect(res.body.message).toMatch(/Conflit d'emploi du temps/);
  });
});
