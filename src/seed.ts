import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { SeedModule } from './seed/seed.module';
import { SeedService } from './seed/seed.service';
import type { SeedMode } from './seed/seed.types';

const logger = new Logger('SeedBootstrap');
const seedModes = ['default', 'bulk', 'same-day', 'tracking-feedback'] as const;

function getSeedMode(): SeedMode {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg?.replace('--mode=', '') ?? 'default';

  if (!seedModes.includes(mode as SeedMode)) {
    throw new Error(
      `Invalid seed mode "${mode}". Expected one of: ${seedModes.join(', ')}`,
    );
  }

  return mode as SeedMode;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seedService = app.get(SeedService);
    await seedService.run({ mode: getSeedMode() });
    logger.log('Database seeding completed successfully.');
  } finally {
    await app.close();
  }
}

void bootstrap();
