import { Module, Global } from '@nestjs/common';

import { DatabaseProvider, DATABASE } from './database.provider';
import type { Database } from './database.types';

export const DRIZZLE_DB = DATABASE;
export type DrizzleDB = Database;

@Global()
@Module({
  providers: [
    DatabaseProvider,
    {
      provide: DATABASE,
      useFactory: (databaseProvider: DatabaseProvider) => databaseProvider.db,
      inject: [DatabaseProvider],
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
