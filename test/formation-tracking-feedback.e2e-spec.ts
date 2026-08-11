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

describe('Formation tracking and feedback (E2E)', () => {
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

  it('learner can PUT feedback when enrolled and GET /feedback/me', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const learner = await insertLearnerUser(ctx.db);
    const learnerTok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(learnerTok))
      .send({ formationId: formation.id })
      .expect(201);

    const res = await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(learnerTok))
      .send({ rating: 4, comment: 'Très bien' })
      .expect(200);

    expect(res.body.rating).toBe(4);
    expect(res.body.comment).toBe('Très bien');

    const me = await api(app)
      .get(`/api/v1/formations/${formation.id}/feedback/me`)
      .set(authHeader(learnerTok))
      .expect(200);
    expect(me.body.rating).toBe(4);
  });

  it('PUT feedback rejects learner not enrolled in formation', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const other = await insertFormationWithRefs(ctx.db);
    const learner = await insertLearnerUser(ctx.db);
    const learnerTok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(learnerTok))
      .send({ formationId: other.formation.id })
      .expect(201);

    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(learnerTok))
      .send({ rating: 3 })
      .expect(403);
  });

  it('PUT feedback rejects rating out of range (high and low)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const learner = await insertLearnerUser(ctx.db);
    const learnerTok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(learnerTok))
      .send({ formationId: formation.id })
      .expect(201);

    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(learnerTok))
      .send({ rating: 6 })
      .expect(400);

    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(learnerTok))
      .send({ rating: -1 })
      .expect(400);
  });

  it('re-PUT updates existing feedback (upsert)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const learner = await insertLearnerUser(ctx.db);
    const learnerTok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(learnerTok))
      .send({ formationId: formation.id })
      .expect(201);

    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(learnerTok))
      .send({ rating: 2 })
      .expect(200);

    const res = await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(learnerTok))
      .send({ rating: 5, comment: 'Updated' })
      .expect(200);

    expect(res.body.rating).toBe(5);
    expect(res.body.comment).toBe('Updated');
  });

  it('teacher GET tracking and feedback when assigned', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `TRK-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    const enrRes = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    const enrId = enrRes.body.enrollment.id as string;

    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-06-01T09:00:00.000Z'),
      endAt: new Date('2026-06-01T11:00:00.000Z'),
      status: 'SCHEDULED',
    });

    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');

    const track = await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/tracking`)
      .set(authHeader(teachTok))
      .expect(200);

    expect(track.body.formation.id).toBe(formation.id);
    expect(track.body.learners).toHaveLength(1);
    expect(track.body.learners[0].enrollmentId).toBe(enrId);
    expect(track.body.attendance.totalSessionsCount).toBe(1);

    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(ltok))
      .send({ rating: 3 })
      .expect(200);

    const fb = await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/feedback`)
      .set(authHeader(teachTok))
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(fb.body.ratingCount).toBe(1);
    expect(fb.body.averageRating).toBe(3);
  });

  it('teacher cannot GET tracking when not assigned', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/tracking`)
      .set(authHeader(teachTok))
      .expect(403);
  });

  it('unassigned teacher cannot GET formation feedback aggregate', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/feedback`)
      .set(authHeader(teachTok))
      .query({ page: 1, limit: 5 })
      .expect(403);
  });

  it('admin can GET formation feedback list and tracking pies', async () => {
    const admin = await insertAdminUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db);
    const learner = await insertLearnerUser(ctx.db);
    const adminTok = await loginAsUser(app, admin.email!, 'EMAIL');
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);

    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(ltok))
      .send({ rating: 5 })
      .expect(200);

    const list = await api(app)
      .get(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(adminTok))
      .query({ page: 1, limit: 5 })
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.aggregate.ratingCount).toBe(1);

    const pies = await api(app)
      .get(`/api/v1/formations/${formation.id}/tracking`)
      .set(authHeader(adminTok))
      .expect(200);

    expect(pies.body.formationId).toBe(formation.id);
    expect(pies.body.summary.ratingCount).toBe(1);
    expect(
      pies.body.ratingPie.find((p: { label: string }) => p.label === '5')
        ?.count,
    ).toBe(1);
  });

  it('top formations includes rating and attendance fields', async () => {
    const admin = await insertAdminUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db);
    const learner = await insertLearnerUser(ctx.db);
    const adminTok = await loginAsUser(app, admin.email!, 'EMAIL');
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    await api(app)
      .put(`/api/v1/formations/${formation.id}/feedback`)
      .set(authHeader(ltok))
      .send({ rating: 4 })
      .expect(200);

    const res = await api(app)
      .get('/api/v1/dashboard/admin/top-formations')
      .set(authHeader(adminTok))
      .query({ limit: 10 })
      .expect(200);

    const row = res.body.find(
      (r: { formationId: string }) => r.formationId === formation.id,
    );
    expect(row).toBeDefined();
    expect(row.ratingCount).toBe(1);
    expect(row.averageRating).toBe(4);
    expect(typeof row.averageAttendanceRate).toBe('number');
    expect(typeof row.totalSessionsCount).toBe('number');
    expect(typeof row.certificateReadyCount).toBe('number');
  });

  it('top learners endpoint returns ranked learners', async () => {
    const admin = await insertAdminUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `TL-${uniqueKey()}`, 40);
    const learner = await insertLearnerUser(ctx.db);
    const adminTok = await loginAsUser(app, admin.email!, 'EMAIL');
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    await insertEnrollment(ctx.db, learner.id, formation.id, 'ENROLLED');
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-07-01T09:00:00.000Z'),
      endAt: new Date('2026-07-01T11:00:00.000Z'),
    });

    const res = await api(app)
      .get('/api/v1/dashboard/admin/top-learners')
      .set(authHeader(adminTok))
      .query({ limit: 5 })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].studentId).toBe(learner.id);
  });

  it('LATE is not counted as present in attendance rate', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `LT-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    const enrRes = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    const enrId = enrRes.body.enrollment.id as string;

    const session = await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-09-01T09:00:00.000Z'),
      endAt: new Date('2026-09-01T11:00:00.000Z'),
      status: 'SCHEDULED',
    });

    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .send({ records: [{ enrollmentId: enrId, status: 'LATE' }] })
      .expect(200);

    const track = await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/tracking`)
      .set(authHeader(teachTok))
      .expect(200);

    expect(track.body.learners[0].attendanceSummary.presentCount).toBe(0);
    expect(track.body.learners[0].attendanceSummary.lateCount).toBe(1);
    expect(track.body.learners[0].attendanceSummary.attendanceRate).toBe(0);
  });

  it('unmarked sessions reduce attendance rate and increase unmarkedCount', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `UM-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    const enrRes = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    const enrId = enrRes.body.enrollment.id as string;

    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-10-01T09:00:00.000Z'),
      endAt: new Date('2026-10-01T11:00:00.000Z'),
      status: 'SCHEDULED',
    });
    const s2 = await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-10-02T09:00:00.000Z'),
      endAt: new Date('2026-10-02T11:00:00.000Z'),
      status: 'SCHEDULED',
    });

    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${s2.id}/attendance`)
      .set(authHeader(teachTok))
      .send({ records: [{ enrollmentId: enrId, status: 'PRESENT' }] })
      .expect(200);

    const track = await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/tracking`)
      .set(authHeader(teachTok))
      .expect(200);

    const summary = track.body.learners[0].attendanceSummary;
    expect(summary.totalSessionsCount).toBe(2);
    expect(summary.presentCount).toBe(1);
    expect(summary.unmarkedCount).toBe(1);
    expect(summary.attendanceRate).toBe(50);
  });

  it('assigned teacher can GET /formations/:id/tracking (pie analytics)', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');

    const pies = await api(app)
      .get(`/api/v1/formations/${formation.id}/tracking`)
      .set(authHeader(teachTok))
      .expect(200);

    expect(pies.body.formationId).toBe(formation.id);
    expect(Array.isArray(pies.body.sessionStatusPie)).toBe(true);
    expect(Array.isArray(pies.body.attendancePie)).toBe(true);
  });

  it('formation tracking pies: percentages sum to 100 when totals non-zero', async () => {
    const admin = await insertAdminUser(ctx.db);
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `PI-${uniqueKey()}`, 40);
    const learner = await insertLearnerUser(ctx.db);
    const adminTok = await loginAsUser(app, admin.email!, 'EMAIL');
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-11-01T09:00:00.000Z'),
      endAt: new Date('2026-11-01T11:00:00.000Z'),
      status: 'SCHEDULED',
    });

    const pies = await api(app)
      .get(`/api/v1/formations/${formation.id}/tracking`)
      .set(authHeader(adminTok))
      .expect(200);

    const sumPct = (arr: Array<{ percentage: number }>) =>
      arr.reduce((s, x) => s + x.percentage, 0);
    expect(sumPct(pies.body.sessionStatusPie)).toBe(100);
    expect(sumPct(pies.body.enrollmentStatusPie)).toBe(100);
  });

  it('excludes cancelled sessions from attendance denominator in summaries', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `CX-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    const enrRes = await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(ltok))
      .send({ formationId: formation.id })
      .expect(201);
    const enrId = enrRes.body.enrollment.id as string;

    await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-08-01T09:00:00.000Z'),
      endAt: new Date('2026-08-01T11:00:00.000Z'),
      status: 'CANCELLED',
    });
    const active = await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-08-02T09:00:00.000Z'),
      endAt: new Date('2026-08-02T11:00:00.000Z'),
      status: 'SCHEDULED',
    });

    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${active.id}/attendance`)
      .set(authHeader(teachTok))
      .send({ records: [{ enrollmentId: enrId, status: 'PRESENT' }] })
      .expect(200);

    const track = await api(app)
      .get(`/api/v1/teachers/me/formations/${formation.id}/tracking`)
      .set(authHeader(teachTok))
      .expect(200);

    expect(track.body.learners[0].attendanceSummary.totalSessionsCount).toBe(1);
    expect(track.body.learners[0].attendanceSummary.attendanceRate).toBe(100);
  });
});
