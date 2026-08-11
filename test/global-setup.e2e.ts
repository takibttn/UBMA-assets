import * as path from 'path';
import * as dotenv from 'dotenv';
import { runMigrations } from './migrate-runner';

export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'E2E globalSetup: DATABASE_URL missing in .env.test. Start test DB: docker compose up -d postgres_test',
    );
  }
  await runMigrations(url);
}
