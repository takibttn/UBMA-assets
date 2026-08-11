import { eq } from 'drizzle-orm';
import { INestApplication } from '@nestjs/common';
import { enrollments as enrollmentsTable } from '../src/database/schema';
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
  findAttendanceByEnrollment,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Session attendance', () => {
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

  async function enrollViaApi(learnerToken: string, formationId: string) {
    await api(app)
      .post('/api/v1/enrollments')
      .set(authHeader(learnerToken))
      .send({ formationId })
      .expect(201);
  }

  it('GET lists only ENROLLED learners and null attendance when unmarked', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `AT-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, formation.id, teacher.id);
    const l1 = await insertLearnerUser(ctx.db);
    const l2 = await insertLearnerUser(ctx.db);
    const l3 = await insertLearnerUser(ctx.db);
    const t1 = await loginAsUser(app, l1.email!, 'EMAIL');
    const t2 = await loginAsUser(app, l2.email!, 'EMAIL');
    await enrollViaApi(t1, formation.id);
    await enrollViaApi(t2, formation.id);
    await insertEnrollment(ctx.db, l3.id, formation.id, 'CANCELLED');
    const session = await insertSession(ctx.db, {
      formationId: formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-27T09:00:00.000Z'),
      endAt: new Date('2026-05-27T11:00:00.000Z'),
    });
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    const res = await api(app)
      .get(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .expect(200);
    expect(res.body.length).toBe(2);
    expect(
      res.body.every(
        (r: { attendance: { id: unknown } }) => r.attendance.id === null,
      ),
    ).toBe(true);
  });

  it('PATCH upserts attendance and sets markedByTeacherId', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `AT-${uniqueKey()}`, 40);
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
      startAt: new Date('2026-05-28T09:00:00.000Z'),
      endAt: new Date('2026-05-28T11:00:00.000Z'),
    });
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .send({
        records: [{ enrollmentId: enrId, status: 'PRESENT' }],
      })
      .expect(200);
    const row = await findAttendanceByEnrollment(ctx.db, session.id, enrId);
    expect(row?.status).toBe('PRESENT');
    expect(row?.markedByTeacherId).toBe(teacher.id);
    expect(row?.markedAt).toBeDefined();
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .send({
        records: [{ enrollmentId: enrId, status: 'ABSENT' }],
      })
      .expect(200);
    const row2 = await findAttendanceByEnrollment(ctx.db, session.id, enrId);
    expect(row2?.status).toBe('ABSENT');
  });

  it('rejects enrollment from other formation', async () => {
    const f1 = await insertFormationWithRefs(ctx.db);
    const f2 = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `AT-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
    await assignTeacherToFormation(ctx.db, f1.formation.id, teacher.id);
    const learner = await insertLearnerUser(ctx.db);
    const ltok = await loginAsUser(app, learner.email!, 'EMAIL');
    await enrollViaApi(ltok, f2.formation.id);
    const [enrWrong] = await ctx.db
      .select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.formationId, f2.formation.id));
    const session = await insertSession(ctx.db, {
      formationId: f1.formation.id,
      roomId: room.id,
      startAt: new Date('2026-05-29T09:00:00.000Z'),
      endAt: new Date('2026-05-29T11:00:00.000Z'),
    });
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .send({
        records: [{ enrollmentId: enrWrong.id, status: 'PRESENT' }],
      })
      .expect(400);
  });

  it('teacher cannot mark for unassigned session', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `AT-${uniqueKey()}`, 40);
    const teacher = await insertTeacher(ctx.db);
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
      startAt: new Date('2026-05-30T09:00:00.000Z'),
      endAt: new Date('2026-05-30T11:00:00.000Z'),
    });
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .send({
        records: [{ enrollmentId: enrId, status: 'PRESENT' }],
      })
      .expect(403);
  });

  it('APPRENANT and ADMIN cannot PATCH attendance', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `AT-${uniqueKey()}`, 40);
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
      startAt: new Date('2026-05-30T12:00:00.000Z'),
      endAt: new Date('2026-05-30T14:00:00.000Z'),
    });
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(ltok))
      .send({
        records: [{ enrollmentId: enrId, status: 'PRESENT' }],
      })
      .expect(403);
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(adminToken))
      .send({
        records: [{ enrollmentId: enrId, status: 'PRESENT' }],
      })
      .expect(403);
  });

  it('rejects invalid status in records', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `AT-${uniqueKey()}`, 40);
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
      startAt: new Date('2026-06-01T09:00:00.000Z'),
      endAt: new Date('2026-06-01T11:00:00.000Z'),
    });
    const teachTok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .patch(`/api/v1/teachers/me/sessions/${session.id}/attendance`)
      .set(authHeader(teachTok))
      .send({
        records: [{ enrollmentId: enrId, status: 'INVALID' }],
      })
      .expect(400);
  });
});
