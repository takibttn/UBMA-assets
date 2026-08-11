import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  text,
  timestamp,
  date,
  unique,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import {
  accountTypeEnum,
  enrollmentStatusEnum,
  paymentStatusEnum,
  roleEnum,
} from './schema.enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }),
    bacYear: integer('bac_year'),
    matricule: varchar('matricule', { length: 50 }),
    password: varchar('password', { length: 255 }).notNull(),
    dob: date('dob'),
    role: roleEnum('role').notNull().default('APPRENANT'),
    accountType: accountTypeEnum('account_type')
      .notNull()
      .default('INTERNAL_STUDENT'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('users_bac_year_matricule_unique').on(
      table.bacYear,
      table.matricule,
    ),
    unique('users_email_unique').on(table.email),
  ],
);

export const teachers = pgTable(
  'teachers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique('teachers_email_unique').on(table.email)],
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    capacity: integer('capacity').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('rooms_is_active_idx').on(table.isActive)],
);

export const formations = pgTable('formations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  languageId: uuid('language_id').references(() => languages.id, {
    onDelete: 'restrict',
  }),
  levelId: uuid('level_id').references(() => formationLevels.id, {
    onDelete: 'restrict',
  }),
  creatorId: uuid('creator_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  price: numeric('price', { precision: 10, scale: 2 }).default('0'),
  capacity: integer('capacity'),
  isSaleOpen: boolean('is_sale_open').notNull().default(false),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const languages = pgTable('languages', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const formationLevels = pgTable(
  'formation_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    languageId: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 10 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    order: integer('order').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('formation_levels_language_code_unique').on(
      table.languageId,
      table.code,
    ),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').notNull().default('ENROLLED'),
    enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  },
  (table) => [
    unique('enrollments_student_formation_unique').on(
      table.studentId,
      table.formationId,
    ),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerCheckoutId: varchar('provider_checkout_id', { length: 255 }),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('DZD'),
    status: paymentStatusEnum('status').notNull().default('PENDING'),
    checkoutUrl: text('checkout_url'),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata'),
    paidAt: timestamp('paid_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payments_enrollment_id_idx').on(table.enrollmentId),
    index('payments_student_id_idx').on(table.studentId),
    index('payments_formation_id_idx').on(table.formationId),
    index('payments_status_idx').on(table.status),
    index('payments_provider_checkout_id_idx').on(table.providerCheckoutId),
    index('payments_provider_checkout_compound_idx').on(
      table.provider,
      table.providerCheckoutId,
    ),
  ],
);
