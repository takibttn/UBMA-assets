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

describe('Enrollment attendance summaries', () => {
  let ctx: E2eContext;
  let app: INestApplication;

  beforeAll(async () => {
    await truncateTestTables();
    ctx = await createE2eApp();
    app = ctx.app;
  });

  beforeEach(async () => {
    await truncateTestTables();
  });

  afterAll(async () => {
    await app.close();
  });

  it('learner profile attendanceSummary counts non-cancelled sessions and rate uses PRESENT only', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `ER-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-07-01T09:00:00.000Z'),
      endAt: new Date('2026-07-01T11:00:00.000Z'),
      status: 'SCHEDULED',
    });
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-07-02T09:00:00.000Z'),
      endAt: new Date('2026-07-02T11:00:00.000Z'),
      status: 'CANCELLED',
    });
    const sessPresent = await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-07-03T09:00:00.000Z'),
      endAt: new Date('2026-07-03T11:00:00.000Z'),
      status: 'SCHEDULED',
    });
    const sessLate = await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-07-04T09:00:00.000Z'),
      endAt: new Date('2026-07-04T11:00:00.000Z'),
      status: 'SCHEDULED',
    });

    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    const enrRes = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    const enrollmentId = enrRes.body.enrollment.id as string;

    const tt = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${sessPresent.id}/attendance`)
      .set(authHeader(tt))
      .send({ records: [{ enrollmentId, status: 'PRESENT' }] })
      .expect(200);
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${sessLate.id}/attendance`)
      .set(authHeader(tt))
      .send({ records: [{ enrollmentId, status: 'LATE' }] })
      .expect(200);

    const profile = await api(app)
      .get('/api/v1/enrollments/me/profile')
      .query({ bucket: 'ALL' })
      .set(authHeader(ltok))
      .expect(200);

    const card = profile.body.data.find(
      (c: { enrollmentId: string }) => c.enrollmentId === enrollmentId,
    );
    expect(card).toBeDefined();
    const sum = card.attendanceSummary;
    expect(sum.totalSessionsCount).toBe(3);
    expect(sum.presentCount).toBe(1);
    expect(sum.lateCount).toBe(1);
    expect(sum.absentCount).toBe(0);
    expect(sum.unmarkedCount).toBe(1);
    expect(sum.attendanceRate).toBe(33);
    expect(typeof sum.attendanceRate).toBe('number');
  });

  it('admin enrollments list includes attendance summary', async () => {
    const admin = await insertAdminUser(ctx.db);
    const adminTok = await loginAsUser(app, admin.email!, 'EMAIL');
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `ER-${uniqueKey()}`, 40);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-08-01T09:00:00.000Z'),
      endAt: new Date('2026-08-01T11:00:00.000Z'),
    });
    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    const enr = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);

    const res = await api(app)
      .get('/api/v1/enrollments')
      .set(authHeader(adminTok))
      .query({ formationId: formation.id, limit: 20 })
      .expect(200);
    const row = res.body.data.find(
      (r: { id: string }) => r.id === enr.body.enrollment.id,
    );
    expect(row?.attendanceSummary?.totalSessionsCount).toBe(1);
    expect(typeof row?.attendanceSummary?.attendanceRate).toBe('number');
  });
});
