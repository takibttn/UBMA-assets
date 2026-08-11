import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DEFAULT_PASSWORD } from './constants';

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

export async function loginAsUser(
  app: INestApplication,
  email: string,
  loginType: 'EMAIL' | 'STUDENT' | 'TEACHER',
  extra?: { bacYear?: number; matricule?: string },
): Promise<string> {
  const body: Record<string, unknown> = {
    loginType,
    email,
    password: DEFAULT_PASSWORD,
  };
  if (loginType === 'STUDENT') {
    body.bacYear = extra?.bacYear;
    body.matricule = extra?.matricule;
    delete body.email;
  }
  const res = await api(app).post('/api/v1/auth/login').send(body).expect(200);
  return res.body.accessToken as string;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
