import { closeTruncatePool } from './utils/test-db';

export default async function globalTeardown(): Promise<void> {
  await closeTruncatePool();
}
