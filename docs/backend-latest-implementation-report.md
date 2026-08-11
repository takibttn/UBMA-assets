# UBMA CEIL — Backend latest implementation report

**Audience:** frontend / client engineers integrating against this API.  
**Scope:** documents **only what exists in the repository today** (no planned features).

---

## 1. Executive summary

### What was implemented

| Item | Description |
|------|-------------|
| **Feature name** | Paid formation enrollment lifecycle with **Chargily Pay–style** checkout (real **Chargily** or **FAKE** provider for tests), **`payments`** persistence, and **webhook–authoritative** payment confirmation. |
| **Business goal** | Support **free** formations (immediate `ENROLLED`) and **paid** formations (`PENDING_PAYMENT` until webhook confirms payment). **Capacity** counts **reserved** seats (`ENROLLED` + `PENDING_PAYMENT`). **No trusted client price**; amount comes from `formations.price`. |
| **Affected modules** | **Payments** (new), **Enrollments**, **Formations** (learner availability + `reservedCount`), **Enrollments repository** (reserved counts, teacher-only `ENROLLED` visibility where applicable), **App bootstrap** (`rawBody`), **Config / env**, **DB migration**, **E2E tests**. |
| **Production readiness** | **Partial:** core lifecycle, webhook verification, and E2E coverage exist. **Production** requires correct env, **HTTPS** public API URL for Chargily webhook, **live keys**, and operational monitoring. Several product features (refunds, emails on pay, rich payment detail on API) are **not** implemented. |
| **Known limitations** | See [§14 Known limitations and TODOs](#14-known-limitations-and-todos). |

---

## 2. Files changed

Grouped for frontend relevance. Paths are relative to the repo root.

### Auth

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| — | **No changes** to auth module for this feature. | Still JWT + role guards as before. |

### Payments / Chargily

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `src/modules/payments/payments.module.ts` | Binds `PAYMENT_PROVIDER` → `ChargilyPaymentProvider` (`useExisting`). | N/A |
| `src/modules/payments/payments.controller.ts` | Webhook + `GET /payments/me` + admin list + admin stats + `GET /payments/:id`. | All payment HTTP entrypoints. |
| `src/modules/payments/payments.service.ts` | Checkout creation, reuse/retry helper, webhook handling (transaction), listings, stats. | Business rules for pay / enroll. |
| `src/modules/payments/payments.repository.ts` | CRUD-style helpers, pagination, admin stats, “open checkout” query. | N/A |
| `src/modules/payments/providers/payment-provider.interface.ts` | `PaymentProvider` + `PAYMENT_PROVIDER` token. | N/A |
| `src/modules/payments/providers/payment-provider.types.ts` | `CreateCheckoutInput`, webhook parse shape. | Reference for understanding metadata (internal). |
| `src/modules/payments/providers/chargily-payment.provider.ts` | `POST {base}/checkouts`, Bearer secret; webhook HMAC verify + JSON parse. | Env vars for live/test. |
| `test/utils/e2e-payment-provider.stub.ts` | Jest-only stub implementing `PaymentProvider` (no Chargily HTTP). | Not shipped. |
| `src/modules/payments/utils/payment-amount.util.ts` | `formationPriceToMinorDzd`, `isFormationFree`, etc. | Server-only price rules. |
| `src/modules/payments/utils/chargily-signature.util.ts` | `verifyChargilySignature`, `signChargilyPayload` (tests). | Webhook = **exact raw body** string UTF-8. |
| `src/modules/payments/utils/payment-webhook-kind.util.ts` | Maps event/checkout strings → `paid` \| `failed` \| … | Explains which webhook shapes work. |
| `src/modules/payments/dto/payment-checkout.dto.ts` | Swagger class for checkout-shaped payment (not all fields returned everywhere). | Align types with `mapToCheckoutDto` reality (§6). |
| `src/modules/payments/dto/find-payments-query.dto.ts` | `FindMyPaymentsQueryDto`, `FindAdminPaymentsQueryDto`. | Query params for list endpoints. |
| `src/modules/payments/dto/admin-payment-stats.dto.ts` | Admin stats shape. | Admin dashboard. |

### Formations

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `src/lib/formations/formation-base.mapper.ts` | `reservedCount` for **spots**; `buildLearnerFormationAvailability` uses **reserved** count; **`PENDING_PAYMENT`** + **`CANCELLED`** learner rules (`canEnroll`, `enrollmentBlockedReason`). | Formation cards: spots, `canEnroll`, `myEnrollment`, blocked reasons. |
| `src/modules/formations/formations.service.ts` | Passes `reservedCount` into mapper and availability; detail + list for **APPRENANT**. | Same API paths; **response fields** semantics changed for capacity. |
| `src/lib/repositories/formations/formations.repository.ts` | `reservedCount` subquery (ENROLLED + PENDING_PAYMENT) alongside `enrolledCount` (ENROLLED only). | `enrolledCount` vs `spotsRemaining` meaning. |

### Enrollments

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `src/modules/enrollments/enrollments.controller.ts` | **`POST :enrollmentId/payment/retry`**; `POST /enrollments` Swagger text. | Retry checkout UX. |
| `src/modules/enrollments/enrollments.service.ts` | New **`enrollStudent`** response shape; free vs paid; **CANCELLED** reactivation; **PENDING** duplicate = reuse checkout; **`retryEnrollmentPayment`**; **`buildEnrollmentWithFormation`**; **Notifications** only on **free** paths (see §7). | **Breaking** response change on `POST /enrollments`. |
| `src/modules/enrollments/enrollments.module.ts` | `forwardRef` → `PaymentsModule`. | N/A |
| `src/modules/enrollments/dto/find-enrollments-query.dto.ts` | `status` allows **`PENDING_PAYMENT`**. | Admin / filters. |
| `src/lib/repositories/enrollments/enrollments.repository.ts` | `countReservedByFormation`, `updateEnrollment`, **`PENDING_PAYMENT`** in types; teacher listings **`ENROLLED`** only; `findFormationEnrollmentsWithStudents` status union. | Roster / capacity vs payment state. |

### Certificates

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| — | **No changes** tied to payments in inspected code. | — |

### Dashboard

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| — | **No changes** to `DashboardModule` in this report’s scope. | New money KPIs: use **`GET /payments/admin/stats`** (Payments controller), not necessarily existing dashboard endpoints. |

### Users

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| — | **No** `UsersModule` / controller changes required for payments. `UsersRepository` is used inside `PaymentsModule` providers. | — |

### Teachers

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `src/lib/repositories/enrollments/enrollments.repository.ts` | Teacher-facing enrollment queries use **`ENROLLED`** only (pending pay not in roster). | Teacher UI must not assume pending learners appear. |

### Rooms / Sessions / Attendance

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| — | **No** direct changes for payment feature. | — |

### Config / Environment

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `.env.example` | Payment-related variables documented. | Client must **never** embed secrets. |
| `.env.test` | E2E: `PAYMENTS_ENABLED`, `PAYMENT_PROVIDER=FAKE`, webhook secret, dummy Chargily key. | Local / CI only. |

### Database / Migrations

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `src/db/schema.ts` | `enrollment_status` + **`PENDING_PAYMENT`**; **`payment_status`** enum; **`payments`** table; relations. | Status values for UI. |
| `drizzle/0002_payment_lifecycle.sql` | Migration: enum value, `payment_status`, `payments`, FKs, indexes, partial unique on `(provider, provider_checkout_id)`. | Deploy pipeline. |
| `drizzle/meta/_journal.json` | Journal entry for `0002` (if present in repo). | `drizzle-kit migrate` / project migrate runner. |

### Tests

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `test/enrollment-payment-lifecycle.e2e-spec.ts` | **New** — free/paid, duplicate pending, capacity, cancelled reactivation, teacher roster. | Contract reference. |
| `test/payments-webhook.e2e-spec.ts` | **New** — HMAC, paid/failed/cancelled, amount mismatch, idempotency. | Webhook behavior. |
| `test/utils/e2e-app.factory.ts` | `createNestApplication({ rawBody: true })`. | — |
| `test/utils/factories.ts` | `insertFormationWithRefs` **`price`** opt.; `insertEnrollment` **`PENDING_PAYMENT`**. | — |
| `test/formations-enrollment-contract.e2e-spec.ts` | Expects **`enrollment`** wrapper on enroll response. | **Breaking** contract. |
| `test/scheduling.enrollment-summary.e2e-spec.ts` | `enrollment.idPath` updated. | — |
| `test/formation-tracking-feedback.e2e-spec.ts` | Id path updated. | — |
| `test/scheduling.attendance.e2e-spec.ts` | Id path updated. | — |

### Docs

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `docs/backend-latest-implementation-report.md` | **This file.** | Single integration handoff. |

### Application wiring

| Path | Change | Frontend relevance |
|------|--------|-------------------|
| `src/app.module.ts` | Imports **`PaymentsModule`**. | — |
| `src/main.ts` | `NestFactory.create(AppModule, { **rawBody: true** })`. | Webhook signature correctness. |

---

## 3. Environment variables

**Naming note:** The codebase does **not** use a single `CHARGILY_SECRET_KEY`. It uses **`CHARGILY_TEST_SECRET_KEY`** / **`CHARGILY_LIVE_SECRET_KEY`** + optional **`CHARGILY_WEBHOOK_SECRET`**.

| Variable | Required | Example | Test vs live | Frontend may see? |
|----------|----------|---------|--------------|-------------------|
| `PAYMENTS_ENABLED` | Optional (default-like: `'false'` string check) | `false` / `true` | If **`false`** and **`PAYMENT_PROVIDER` ≠ `FAKE`**, paid enroll → **503**. E2E sets `true`. | **No** |
| `PAYMENT_PROVIDER` | Optional (default `CHARGILY`) | `FAKE` / `CHARGILY` | `FAKE` bypasses real Chargily API; used in tests. | **No** |
| `CHARGILY_MODE` | Optional | `test` / `live` | Selects base URL and which **secret key** is loaded. | **No** |
| `CHARGILY_TEST_SECRET_KEY` | Required for real checkout in **test** mode | *(secret)* | Bearer token to Chargily test API. | **Never** |
| `CHARGILY_LIVE_SECRET_KEY` | Required for real checkout in **live** mode | *(secret)* | Bearer token to Chargily live API. | **Never** |
| `CHARGILY_TEST_BASE_URL` | Optional | `https://pay.chargily.net/test/api/v2` | Test API root. | **No** |
| `CHARGILY_LIVE_BASE_URL` | Optional | `https://pay.chargily.net/api/v2` | Live API root. | **No** |
| `CHARGILY_WEBHOOK_SECRET` | **Recommended** for production webhooks | *(secret)* | Used for **HMAC**. If unset, **Chargily** provider falls back to **API secret** for verification (`?? secretKey()` in code). **FAKE** provider: if empty, signature is **not** verified (unsafe for public exposure). | **Never** |
| `CHARGILY_WEBHOOK_SIGNATURE_HEADER` | Optional | `signature` | Header **name** Cloud/Nest must read (not the HMAC value). | **No** (name only is not secret) |
| `APP_PUBLIC_URL` | Optional | `http://localhost:3000` | Prefix for **success/failure** redirect URLs sent to Chargily. | Public URLs only |
| `API_PUBLIC_URL` | Optional | `http://localhost:3200/api/v1` | Used to build **`webhook_endpoint`** `{API_PUBLIC_URL}/payments/webhook/chargily`. Must match what Chargily can reach. | **No** |
| `PAYMENT_SUCCESS_PATH` | Optional | `/payment/success` | Appended to `APP_PUBLIC_URL`. | Defines frontend routes |
| `PAYMENT_FAILURE_PATH` | Optional | `/payment/failure` | Appended to `APP_PUBLIC_URL`. | Defines frontend routes |
| `PAYMENT_CHECKOUT_LOCALE` | Optional | `fr` | Passed to Chargily checkout body. | **No** |
| `PAYMENT_METHOD` | Optional | `edahabia` | Passed to Chargily. | **No** |
| `PAYMENT_FEES_ALLOCATION` | Optional | `customer` | Passed to Chargily. | **No** |

### Variables from your template that map to this repo

| You asked (template) | In this codebase |
|---------------------|------------------|
| `CHARGILY_SECRET_KEY` | **Not used.** Use **`CHARGILY_TEST_SECRET_KEY`** / **`CHARGILY_LIVE_SECRET_KEY`**. |
| `CHARGILY_WEBHOOK_SECRET` | **Used** (see table). |
| `CHARGILY_WEBHOOK_SIGNATURE_HEADER` | **Used** — default **`signature`**. |
| `CHARGILY_API_BASE_URL` | **Split:** `CHARGILY_TEST_BASE_URL` / `CHARGILY_LIVE_BASE_URL` (+ `CHARGILY_MODE`). |
| `CHARGILY_SUCCESS_URL` | **Derived:** `APP_PUBLIC_URL` + `PAYMENT_SUCCESS_PATH`. |
| `CHARGILY_FAILURE_URL` | **Derived:** `APP_PUBLIC_URL` + `PAYMENT_FAILURE_PATH`. |
| `CHARGILY_WEBHOOK_URL` | **Derived:** `API_PUBLIC_URL` + `/payments/webhook/chargily` (after trim). |

---

## 4. Database changes

### Enums

- **`enrollment_status`** (Postgres): added value **`PENDING_PAYMENT`** (migration uses `ADD VALUE IF NOT EXISTS`).  
  - Drizzle order in schema: `PENDING_PAYMENT`, `ENROLLED`, `CANCELLED`.  
  - Column default in schema remains `'ENROLLED'` for inserts that don’t set status.

- **`payment_status`** (new): `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`.

### Table `payments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|--------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `enrollment_id` | `uuid` | NO | — | FK → `enrollments.id` **ON DELETE CASCADE** |
| `student_id` | `uuid` | NO | — | FK → `users.id` **ON DELETE CASCADE** |
| `formation_id` | `uuid` | NO | — | FK → `formations.id` **ON DELETE CASCADE** |
| `provider` | `varchar(50)` | NO | — | e.g. `CHARGILY`, `FAKE` |
| `provider_checkout_id` | `varchar(255)` | YES | — | From provider |
| `provider_payment_id` | `varchar(255)` | YES | — | From webhook when paid |
| `amount` | `numeric(10,2)` | NO | — | Server-side amount (string in API responses) |
| `currency` | `varchar(10)` | NO | `'DZD'` | |
| `status` | `payment_status` | NO | `'PENDING'` | |
| `checkout_url` | `text` | YES | — | |
| `failure_reason` | `text` | YES | — | e.g. `amount_mismatch`, provider errors |
| `metadata` | `jsonb` | YES | — | Provider / webhook payloads |
| `paid_at` | `timestamp` | YES | — | |
| `expires_at` | `timestamp` | YES | — | Checkout expiry (or +30 min fallback after create) |
| `created_at` | `timestamp` | NO | `now()` | |
| `updated_at` | `timestamp` | NO | `now()` | |

**Indexes / constraints** (see `drizzle/0002_payment_lifecycle.sql`):

- B-tree: `enrollment_id`, `student_id`, `formation_id`, `status`, `provider_checkout_id`, `(provider, provider_checkout_id)`.
- **Partial unique:** `payments_provider_checkout_unique` on `(provider, provider_checkout_id)` **WHERE** `provider_checkout_id IS NOT NULL`.

### Webhook “event storage”

- **Not** a dedicated `webhook_events` table. **Last** webhook payload / provider data may appear inside `payments.metadata` JSON (implementation writes `webhookEvent` / `providerCreate` in some paths).

### Migrations

- **File:** `drizzle/0002_payment_lifecycle.sql`
- **Run:** project scripts (see `package.json`): e.g. `npm run db:migrate` / `drizzle-kit migrate` as your ops use; **E2E** uses `test/global-setup.e2e.ts` migrate runner with `DATABASE_URL` from `.env.test`.

### Seed data

- **No** payment-specific seed changes documented in code inspection.

---

## 5. Full API endpoint inventory (changed / new)

Global prefix: **`/api/v1`**.

### `POST /enrollments`

**Auth:** `APPRENANT` (JWT).

**Request DTO:**

```ts
type CreateEnrollmentDto = {
  formationId: string; // uuid
};
```

**Response (201)** — **wrapper object** (breaking vs older flat enrollment + `formation` at top level):

```ts
type CreateEnrollmentResponse =
  | {
      enrollment: EnrollmentWithFormation;
      paymentRequired: false;
    }
  | {
      enrollment: EnrollmentWithFormation;
      paymentRequired: true;
      payment: PaymentCheckoutClientDto;
    };

// EnrollmentWithFormation matches service shape:
type EnrollmentWithFormation = {
  id: string;
  studentId: string;
  formationId: string;
  status: 'PENDING_PAYMENT' | 'ENROLLED' | 'CANCELLED';
  enrolledAt: string; // ISO
  formation: FormationBaseDto & { createdAt?: string }; // includes enrolledCount, reservedCount-driven spotsRemaining, etc.
};

// What the API returns today for payment (paymentsService.mapToCheckoutDto):
type PaymentCheckoutClientDto = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  amount: string;
  currency: 'DZD';
  checkoutUrl: string | null;
  expiresAt: string | null; // ISO or null
};
```

**Errors (non-exhaustive):**

| Status | When |
|--------|------|
| `400` | Sale closed; formation full; invalid price; Chargily checkout failure bubbles as `BadRequestException` in some paths; etc. |
| `401` | Missing / invalid JWT |
| `403` | — |
| `404` | Formation not found (wording may vary) |
| `409` | Already **`ENROLLED`** for same formation |
| `503` | Paid enrollment attempted while `PAYMENTS_ENABLED` is not `'true'` **unless** `PAYMENT_PROVIDER=FAKE` — message: *Le paiement en ligne est désactivé pour le moment.* |

**Business rules (summary):**

- **Free** (`price` null / empty / ≤ 0): `ENROLLED`, `paymentRequired: false`, optional notification (free path).
- **Paid:** `PENDING_PAYMENT`, create checkout, `paymentRequired: true` + `payment` with `checkoutUrl`.
- **Duplicate** request while **`PENDING_PAYMENT`**: same enrollment row; **reuse** non-expired open checkout or create new attempt.
- **Cancelled** row: reactivate same `(studentId, formationId)`; free → `ENROLLED`; paid → `PENDING_PAYMENT` + checkout.
- **Capacity:** `countReservedByFormation` = statuses `ENROLLED` + `PENDING_PAYMENT`.

**Frontend notes:**

- **Do not** treat success redirect as paid — poll payment / enrollment state (§10).
- Invalidate formations list, enrollment lists, learner profile after enroll.

---

### `POST /enrollments/:enrollmentId/payment/retry`

**Auth:** `APPRENANT`.

**Request body:** none.

**Response (200)** — Nest default (not 201):

```ts
type RetryPaymentResponse = {
  enrollment: EnrollmentWithFormation;
  payment: PaymentCheckoutClientDto;
};
```

**Errors:**

| Status | When |
|--------|------|
| `400` | Enrollment not in `PENDING_PAYMENT` |
| `401` | Unauthenticated |
| `404` | Enrollment not found / not owned |
| `503` | Payments disabled (same rule as enroll) |

**Frontend notes:** “Continue payment” / refresh checkout when `payment.checkoutUrl` expired or user returns from failure.

---

### `POST /payments/webhook/chargily`

**Auth:** **Public** (no JWT). **Signature** required (except **FAKE** provider when `CHARGILY_WEBHOOK_SECRET` is empty — **dev/test only**).

**Request:** raw JSON body (must match signed bytes — §8).

**Response:**

```ts
type WebhookAck = { received: true };
```

**Status codes:**

| Status | When |
|--------|------|
| `200` | Processed or ignored safely (unknown checkout logs and returns OK) |
| `400` | Missing raw body buffer; missing signature (Chargily path); invalid JSON |
| `403` | Invalid HMAC |

**Frontend notes:** Browsers **do not** call this; **Chargily servers** do.

---

### `GET /payments/me`

**Auth:** `APPRENANT`.

**Query:** `FindMyPaymentsQueryDto` extends pagination:

```ts
type FindMyPaymentsQuery = {
  page?: number;    // default 1
  limit?: number; // default 10, max 100
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  formationId?: string;
};
```

**Response:** `PaginatedResponse` where each row is:

```ts
type MyPaymentRow = {
  payment: PaymentCheckoutClientDto;
  formationTitle: string;
  enrollmentStatus: string; // enrollment row status from DB
};
```

**Frontend notes:** Poll-friendly list after redirect.

---

### `GET /payments`

**Auth:** `ADMIN`.

**Query:** `FindAdminPaymentsQueryDto` = payment filters + **inherits `search`** from `PaginationQueryDto` (student / formation text search in repository) + `from` / `to` (strings parsed to `Date`).

**Response:** Paginated rows:

```ts
type AdminPaymentRow = {
  payment: PaymentCheckoutClientDto;
  student: {
    firstName: string;
    lastName: string;
    email: string | null;
    matricule: string | null;
  };
  formationTitle: string;
  formationPrice: string | null;
  enrollmentStatus: string;
};
```

---

### `GET /payments/admin/stats`

**Auth:** `ADMIN`.

**Response:**

```ts
type AdminPaymentStats = {
  pendingCount: number;  // PENDING + PROCESSING
  paidCount: number;
  failedCount: number;
  cancelledCount: number;
  expiredCount: number;
  totalPaidAmount: string; // sum of PAID amounts, DB text
};
```

---

### `GET /payments/:id`

**Auth:** `ADMIN` **or** owner **`APPRENANT`**.

**Response:** `PaymentCheckoutClientDto` **only** (no `failureReason`, no provider IDs in this payload).

**Errors:** `404` payment missing; `403` if learner and not owner.

---

### Other enrollment / formation endpoints

- **`GET /enrollments`**, **`GET /enrollments/me`**, teacher routes, etc. — **not** re-specified here except:
  - **`FindEnrollmentsQueryDto.status`** now allows **`PENDING_PAYMENT`** for filters.
  - **Formation list/detail** for **`APPRENANT`** may include **`enrollmentBlockedReason`:** **`PENDING_PAYMENT`** | **`ALREADY_ENROLLED`** | etc., and **`canEnroll`** / **`myEnrollment`** with status including **`PENDING_PAYMENT`**.

---

## 6. DTOs and TypeScript contracts

### Pagination envelope

```ts
type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = { data: T[]; meta: PaginationMeta };
```

### `CreateEnrollmentDto`

- **File:** `src/modules/enrollments/dto/create-enrollment.dto.ts`
- **Validation:** `formationId` required UUID.

### `FindEnrollmentsQueryDto` (excerpt)

- **File:** `src/modules/enrollments/dto/find-enrollments-query.dto.ts`
- **`status`:** optional `'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT'`.

### Payment query DTOs

- **File:** `src/modules/payments/dto/find-payments-query.dto.ts`
- **`FindMyPaymentsQueryDto`:** extends `PaginationQueryDto` + optional `status`, `formationId`.
- **`FindAdminPaymentsQueryDto`:** + `formationId`, `studentId`, `from`, `to`; **`search`** comes from parent pagination DTO.

### Swagger classes vs runtime

- **`PaymentCheckoutDto`** (`src/modules/payments/dto/payment-checkout.dto.ts`) documents enums similar to runtime **`mapToCheckoutDto`** — client should treat **`mapToCheckoutDto`** as source of truth (no `failureReason`).

### Enums (DB / API)

**Enrollment status (API):** `PENDING_PAYMENT` | `ENROLLED` | `CANCELLED`  
**Payment status (API):** `PENDING` | `PROCESSING` | `PAID` | `FAILED` | `CANCELLED` | `EXPIRED`  
**REFUNDED:** **not implemented**.

---

## 7. Business logic

### Who can do what

| Action | Role |
|--------|------|
| Enroll / retry pay | `APPRENANT` |
| List own payments / get payment by id | `APPRENANT` (own) |
| List all payments / stats | `ADMIN` |
| Webhook | Public (HMAC) |

### Enrollment (`enrollStudent`)

1. Load formation; 404 if missing.
2. **Sale closed** → `400` (*Les inscriptions sont fermées…*).
3. If **`ENROLLED`** already → **`409`** (*déjà inscrit*).
4. If **`PENDING_PAYMENT`** → **reuse** checkout (`createOrReuseCheckoutForPendingEnrollment`) — **no** new enrollment row.
5. If **`CANCELLED`** → check **reserved** capacity; then either **`ENROLLED`** (free) or **`PENDING_PAYMENT`** + checkout (paid); **validate** paid payments available first for paid.
6. **New row:** check reserved capacity; free → create `ENROLLED` + notify; paid → `validatePaidPaymentsAvailable`, create `PENDING_PAYMENT`, `createCheckoutForPendingEnrollment`.
7. **Notifications:** `triggerEnrollmentNotification` runs on **free** create / **free** cancelled revival only (inspected call sites). **Not** automatically on webhook-paid.

### Payment checkout creation

1. Insert `payments` row `PENDING`.
2. Call provider `createCheckout` (Chargily HTTP or Fake).
3. On success: update `provider_checkout_id`, `checkout_url`, `expires_at`, `metadata.providerCreate`.
4. On failure: mark payment **`FAILED`**, rethrow error.

### Transactions

- **Webhook** handling uses **`db.transaction`** for payment + enrollment updates.

### External API

- **Chargily:** `POST {baseUrl}/checkouts` with `Authorization: Bearer <secret>`.

---

## 8. Webhook logic

| Item | Value |
|------|--------|
| **Path** | `POST /api/v1/payments/webhook/chargily` |
| **Auth** | None (signature) |
| **Raw body** | **Required:** `req.rawBody` must be a **Buffer** (`NestFactory.create(..., { rawBody: true })`). If missing → **400** *Corps brut requis pour la signature*. |
| **Signature header** | Config `CHARGILY_WEBHOOK_SIGNATURE_HEADER`, default **`signature`**. Also accepts `Signature` as fallback in Chargily provider. |
| **Algorithm** | **HMAC-SHA256** over the **exact UTF-8 string** of the raw body; digest **hex**; compared with **timing-safe** equality to header value (`chargily-signature.util.ts`). |
| **Secret** | `CHARGILY_WEBHOOK_SECRET` if set; else **Chargily provider** uses **API secret** (`test`/`live` key). **FAKE:** if secret **empty**, verification **skipped** (only for local trust boundaries). |
| **Parse** | After verify: `JSON.parse` raw string. Invalid JSON → **400** *Corps webhook invalide*. Bad signature → **403** *Signature invalide*. Missing signature → **400** *Signature manquante*. |

### Event handling (`resolveWebhookPaymentKind` + service)

Payment row is found by **`provider_checkout_id`** = `event.checkout.id`.

| Resolved kind | Payment | Enrollment |
|---------------|---------|------------|
| `paid` | If amount **matches** `Math.round(Number(pay.amount))` → `PAID`, `paid_at`, optional `provider_payment_id`. If mismatch → **`failure_reason: amount_mismatch`**, status stays **not** upgraded to PAID (stays e.g. `PENDING`). | `ENROLLED` on successful paid |
| `failed` | `FAILED` | **unchanged** (stays `PENDING_PAYMENT` if it was) |
| `cancelled` | `CANCELLED` | `CANCELLED` |
| `expired` | `EXPIRED` | `CANCELLED` |
| `processing` | `PROCESSING` | unchanged |
| `pending` | `PENDING` | unchanged |
| `unknown` | no DB change | — |

**Idempotency:** If payment already **`PAID`** and kind is `paid`, transaction **returns early** (no duplicate writes).

**Unknown checkout id:** Logs warning; still **200** `{ received: true }`.

### Example payloads (synthetic)

**Paid:**

```json
{
  "type": "checkout.paid",
  "checkout": { "id": "chk_xxx", "status": "paid", "amount": 1500 }
}
```

**Failed:**

```json
{
  "type": "checkout.failed",
  "checkout": { "id": "chk_xxx", "status": "failed", "amount": 1500 }
}
```

Exact Chargily payloads may wrap `checkout` under `data`; provider parser accepts several shapes.

---

## 9. State machines and statuses

### Enrollment (`enrollment_status`)

| Status | Meaning | Set when | Frontend label (FR suggestion) |
|--------|---------|----------|--------------------------------|
| `PENDING_PAYMENT` | Seat reserved; awaiting successful pay | Paid enroll; cancelled→paid reactivation | *Paiement en attente* |
| `ENROLLED` | Active learner access | Free enroll; webhook paid; free reactivation | *Inscrit* |
| `CANCELLED` | Not active; row kept for uniqueness | Admin/user cancel (existing flows); webhook cancel/expired | *Inscription annulée* |

**Transitions (implemented paths):**

- `→ PENDING_PAYMENT`: new paid enroll; paid revival from `CANCELLED`.
- `PENDING_PAYMENT` → `ENROLLED`: webhook **paid** (amount OK).
- `PENDING_PAYMENT` → `CANCELLED`: webhook **cancelled** / **expired**.
- `CANCELLED` → `ENROLLED` or `PENDING_PAYMENT`: `POST /enrollments` revival.

### Payment (`payment_status`)

| Status | Meaning | FR suggestion |
|--------|---------|---------------|
| `PENDING` | Checkout created / awaiting completion | *En attente* |
| `PROCESSING` | In progress (webhook) | *En cours* |
| `PAID` | Succeeded | *Payé* |
| `FAILED` | Failed / checkout creation error | *Échoué* |
| `CANCELLED` | Cancelled | *Annulé* |
| `EXPIRED` | Expired | *Expiré* |

**`REFUNDED`:** **not implemented.**

### Formation sale

- Still **`isSaleOpen`** boolean on formation; no new enum in schema.

---

## 10. Frontend integration guide

### Suggested endpoint constants

```ts
export const API = {
  enrollments: '/enrollments',
  enrollmentRetryPay: (enrollmentId: string) =>
    `/enrollments/${enrollmentId}/payment/retry`,
  paymentsMe: '/payments/me',
  paymentsAdmin: '/payments',
  paymentsAdminStats: '/payments/admin/stats',
  paymentById: (id: string) => `/payments/${id}`,
} as const;
```

### Suggested TypeScript types

Mirror §5 `CreateEnrollmentResponse`, `PaymentCheckoutClientDto`, `PaginatedResponse`.

### Suggested React Query keys

```ts
['enrollments', 'me'];
['enrollments', 'me', 'profile'];
['formations'];
['formations', formationId];
['payments', 'me', query];
['payments', paymentId];
['payments', 'admin', query];
['payments', 'admin', 'stats'];
```

### Mutations

- **`useEnrollMutation`:** `POST /enrollments` with `{ formationId }`.
- **`useRetryPaymentMutation`:** `POST /enrollments/:id/payment/retry`.

### Invalidation strategy

After **enroll** or **retry:** invalidate `formations`, `enrollments/me`, `enrollments/me/profile`, and `payments/me`.  
After **webhook** (user lands on success page): **poll** `payments/me` or `GET /payments/:id` until `status === 'PAID'` or timeout; then invalidate enrollments profile.

### Paid formation flow (exact order)

1. `POST /enrollments` `{ formationId }`.
2. If `paymentRequired` **and** `payment.checkoutUrl` → **redirect** (`window.location.href = checkoutUrl` or Chargily widget if you add one later — current API assumes redirect URL).
3. User completes or aborts on Chargily; **redirect** to `APP_PUBLIC_URL` + success/failure path (configured server-side).
4. **Success page:** **do not** show “payé” definitively until backend confirms — poll `GET /payments/me` or `GET /payments/:id` (if you stored `payment.id`).
5. Show states: **pending confirmation**, **paid**, **failed** (allow retry), **cancelled/expired** (re-enroll or `POST /enrollments` again per UX).
6. Invalidate caches when status stabilizes.

### Toasts (suggestions)

- **503 payments disabled:** *Le paiement en ligne est indisponible.*  
- **409 already enrolled:** *Vous êtes déjà inscrit.*  
- **400 full:** *Cette formation est complète.*

---

## 11. Error handling guide

| HTTP | Source / message (examples) | Meaning | FR UI suggestion |
|------|-----------------------------|---------|-------------------|
| `400` | Sale closed, full, invalid webhook body, missing signature, invalid `from`/`to` | Bad input or server rule | Use message body if safe |
| `401` | JWT | Not logged in | *Session expirée* |
| `403` | Payment not owned; invalid webhook HMAC | Forbidden | Webhook: N/A for end user |
| `404` | Formation, enrollment, payment | Not found | *Ressource introuvable* |
| `409` | Already enrolled | Duplicate ENROLLED | *Déjà inscrit* |
| `503` | Payments disabled | Config | *Paiement indisponible* |

Webhook signature errors are **400/403** — **frontend must not** surface as user toasts unless you build an admin “webhook debugger.”

---

## 12. Security notes

- **JWT + roles** on all user/admin payment endpoints.
- **Secrets:** never sent to browser; only server env.
- **Amount:** derived from **`formations.price`** server-side; **`CreateEnrollmentDto`** has **no** price field.
- **Webhook:** requires **raw body** at app bootstrap; proxies must not alter body bytes.
- **Idempotency:** duplicate **paid** webhooks do not corrupt `PAID` row (early return).
- **FAKE provider** without webhook secret skips HMAC — **not** for public internet exposure.

---

## 13. Tests

| Suite | Path | Coverage |
|-------|------|----------|
| Payment lifecycle E2E | `test/enrollment-payment-lifecycle.e2e-spec.ts` | Free/paid enroll, duplicate pending, capacity + pending, cancelled reactivation, teacher roster ENROLLED-only |
| Webhook E2E | `test/payments-webhook.e2e-spec.ts` | Missing/invalid sig, paid/failed/cancel path, amount mismatch, idempotent paid |
| Contract / scheduling E2E | Updated files under `test/` | Enroll response shape / id paths |

**Unit tests:** minimal (`jest` reports **1** test suite / **1** test in this environment — payments rely heavily on **E2E**).

---

## 14. Known limitations and TODOs

- **Refunds:** not implemented.
- **Invoice / tax tables:** not implemented.
- **Webhook event log table:** not implemented (only JSON metadata on `payments` sometimes).
- **Email / push on `PAID`:** not wired in webhook flow (free enrollment email path still exists).
- **API exposes** slim payment DTO (**no** `failureReason` / provider IDs on `GET` responses) — may limit admin UX without DB or future endpoint.
- **Chargily** signature spec must match production (confirm header name + payload nesting with Chargily v2 docs).
- **Dashboard** module not integrated with payment stats beyond new **`GET /payments/admin/stats`** endpoint.
- **Manual expire** job for stale checkouts: not implemented (expiry is stored; reuse logic uses `expiresAt`).

---

## 15. Final frontend checklist

- [ ] Add API path constants (§10).
- [ ] Add types for **`CreateEnrollmentResponse`** (nested `enrollment`).
- [ ] Replace any code expecting **`POST /enrollments`** flat body with wrapper shape.
- [ ] Add **`POST …/payment/retry`** mutation.
- [ ] Add **`GET /payments/me`** + optional **`GET /payments/:id`** polling after Chargily redirect.
- [ ] Implement success/failure pages that **poll** rather than assume paid.
- [ ] Map **`PENDING_PAYMENT`** / **`enrollmentBlockedReason`** on formation cards (*Continuer le paiement*, etc.).
- [ ] Invalidate **formations** + **enroll lists** after state changes.
- [ ] **Never** store or log Chargily secrets in the client.
- [ ] Verify **`spotsRemaining`** uses reserved seats (full formation with pending seat).

---

## 16. Commands and results

Commands were run in the development environment used for this report:

| Command | Result |
|---------|--------|
| `npm run build` | **Success** (Nest compile) |
| `npm run test` | **Success** — 1 suite, 1 test (Jest default `src/**/*.spec.ts`; project is E2E-heavy) |
| `npm run test:e2e` | **Success** — 16 suites, 120 tests, ~50s (with test DB / `.env.test` as configured). |
| `npm run db:migrate` / seed | **Not** executed as part of writing this document; use your CI / local DB workflow. |

---

*End of report — generated from repository inspection (UBMA CEIL backend as of the report date).*
