import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error(
    'E2E: DATABASE_URL missing. Copy .env.example to .env.test, set DATABASE_URL to postgres_test (port 5437), then: docker compose up -d postgres_test',
  );
}

if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = 'test-jwt-secret-e2e';
}

process.env.NODE_ENV = 'test';
