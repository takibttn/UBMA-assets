import { INestApplication } from '@nestjs/common';
import { createE2eApp } from './utils/e2e-app.factory';
import { api } from './utils/http-helpers';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const ctx = await createE2eApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1 returns greeting', async () => {
    const res = await api(app).get('/api/v1').expect(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(0);
  });
});
