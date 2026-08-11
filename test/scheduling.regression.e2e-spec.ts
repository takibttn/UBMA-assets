import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  insertAdminUser,
  insertFormationWithRefs,
  insertRoom,
  uniqueKey,
} from './utils/factories';
import { truncateTestTables } from './utils/test-db';
import { createE2eApp, E2eContext } from './utils/e2e-app.factory';
import { api, authHeader, loginAsUser } from './utils/http-helpers';

describe('Scheduling regressions', () => {
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

  it('POST sessions/preview is not captured as :sessionId (validation 400, not route 404)', async () => {
    const admin = await insertAdminUser(ctx.db);
    const tok = await loginAsUser(app, admin.email!, 'EMAIL');
    const { formation } = await insertFormationWithRefs(ctx.db);
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 20);
    const res = await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/preview`)
      .set(authHeader(tok))
      .send({ weeklySlots: [] })
      .expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('POST sessions/generate same routing stability', async () => {
    const admin = await insertAdminUser(ctx.db);
    const tok = await loginAsUser(app, admin.email!, 'EMAIL');
    const { formation } = await insertFormationWithRefs(ctx.db);
    await api(app)
      .post(`/api/v1/formations/${formation.id}/sessions/generate`)
      .set(authHeader(tok))
      .send({ weeklySlots: [] })
      .expect(400);
  });

  it('unknown formation id on preview returns 404 from service not param parsing failure', async () => {
    const admin = await insertAdminUser(ctx.db);
    const tok = await loginAsUser(app, admin.email!, 'EMAIL');
    const fid = randomUUID();
    const room = await insertRoom(ctx.db, `R-${uniqueKey()}`, 20);
    await api(app)
      .post(`/api/v1/formations/${fid}/sessions/preview`)
      .set(authHeader(tok))
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
      .expect(404);
  });
});
