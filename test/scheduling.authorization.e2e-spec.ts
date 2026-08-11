import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  insertAdminUser,
  insertFormationWithRefs,
  insertLearnerUser,
  insertTeacher,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Scheduling authorization matrix', () => {
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

  it('returns 401 when listing rooms without a token', async () => {
    await api(app).get('/api/v1/rooms').expect(401);
  });

  it('APPRENANT receives 403 on room management', async () => {
    const learner = await insertLearnerUser(ctx.db);
    const tok = await loginAsUser(app, learner.email!, 'EMAIL');
    await api(app)
      .post('/api/v1/rooms')
      .set(authHeader(tok))
      .send({
        code: `S-${uniqueKey()}`,
        name: 'x',
        capacity: 10,
      })
      .expect(403);
  });

  it('ENSEIGNANT receives 403 on session preview', async () => {
    const { formation } = await insertFormationWithRefs(ctx.db);
    const teacher = await insertTeacher(ctx.db);
    const tok = await loginAsUser(app, teacher.email, 'TEACHER');
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(tok))
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
      .expect(403);
  });

  it('ADMIN receives 403 on teacher-only calendar', async () => {
    const admin = await insertAdminUser(ctx.db);
    const tok = await loginAsUser(app, admin.email!, 'EMAIL');
    await api(app)
      .get('/api/v1/teachers/me/calendar')
      .set(authHeader(tok))
      .expect(403);
  });
});
