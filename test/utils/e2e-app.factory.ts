import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DRIZZLE_DB, DrizzleDB } from '../../src/database/database.module';
import { PAYMENT_PROVIDER } from '../../src/modules/payments/providers/payment-provider.interface';
import { E2ePaymentProviderStub } from './e2e-payment-provider.stub';

export type E2eContext = {
  app: INestApplication;
  db: DrizzleDB;
};

export async function createE2eApp(): Promise<E2eContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PAYMENT_PROVIDER)
    .useClass(E2ePaymentProviderStub)
    .compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const db = app.get<DrizzleDB>(DRIZZLE_DB);
  return { app, db };
}
