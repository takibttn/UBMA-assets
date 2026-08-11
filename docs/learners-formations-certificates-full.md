# Learners, formations & certificates — full API guide

Single reference for **internal students**, **external learners**, and **teachers**: browsing formations, enrolling, and certificates. All paths are under the global prefix **`/api/v1`** ([`main.ts`](../src/main.ts)). Send `Authorization: Bearer <accessToken>` on protected routes.

**JWT roles** (claim `role`):

| Role in JWT | Typical actor |
|-------------|----------------|
| `APPRENANT` | Learner in `users`: internal university student **or** external learner (`accountType` distinguishes them in login/register payload — both use the same enrollment & certificate learner APIs). |
| `ENSEIGNANT` | Teacher in the dedicated `teachers` table (`sub` = teacher id). |
| `ADMIN` | Platform administrator. |

---

## 1. Authentication

### 1.1 Register (external learners only)

`POST /api/v1/auth/register`

Creates **`APPRENANT`** + **`EXTERNAL_LEARNER`** with email/password and returns the same body shape as login (JWT + user).

**Body:** `firstName`, `lastName`, `email`, `password` (min 6), `dob` (ISO `YYYY-MM-DD`).

**Errors:** `409` email already registered; `400` validation.

### 1.2 Login

`POST /api/v1/auth/login`

**Body:**

| `loginType` | Required fields |
|-------------|-----------------|
| `STUDENT` | `bacYear`, `matricule`, `password` — internal students provisioned in `users`. |
| `EMAIL` | `email`, `password` — learner/admin login via email (`APPRENANT` or `ADMIN`). |
| `TEACHER` | `email`, `password` — teacher account in `teachers`. |

**Success:** `{ accessToken, user: { id, firstName, lastName, role, accountType, email } }`.

- For **`TEACHER`**, `role` is `ENSEIGNANT` and `id` is the **teacher** id (used for teacher-scoped routes).
- For **`APPRENANT`**, `id` is the **`users.id`** used as `studentId` on enrollments.

**Errors:** `401` invalid credentials.

---

## 2. Formations (catalog)

Anyone **authenticated** can list and read formations. Only **ADMIN** can create, update, toggle sale, or delete.

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `GET` | `/formations` | Any auth | Paginated catalog: filters `search`, `languageId`, `levelId`, `sortBy` (`createdAt` \| `title` \| `startDate` \| `price`), `sortOrder`, `page`, `limit`. Each row includes `language`, `level`, and **`enrolledCount`** (active `ENROLLED` only). |
| `GET` | `/formations/:id` | Any auth | Detail (same shape as list row, **without** `enrolledCount`). `404` if missing. |
| `POST` | `/formations` | ADMIN | Create (`CreateFormationDto`: title, description, language/level, price, capacity, dates; `startDate < endDate`). |
| `PATCH` | `/formations/:id` | ADMIN | Partial update. If `startDate`/`endDate` change and both bounds exist afterward, **teacher schedule overlap** and **undated sibling** rules apply → `400` / `409`. |
| `PATCH` | `/formations/:id/sale` | ADMIN | Body `{ isSaleOpen: boolean }`. |
| `DELETE` | `/formations/:id` | ADMIN | `204` on success. |
| `GET` | `/formations/admin/stats` | ADMIN | Dashboard cards (`totalFormations`, `openSales`, `closedSales`, `upcomingFormations`). |
| `GET` | `/formations/admin/analytics` | ADMIN | `byStatus`, `byLanguage`, `byLevel` for charts. |

**Learner UX:** use `isSaleOpen` and `enrolledCount` vs `capacity` (if not null) before calling `POST /enrollments`.  
**Teachers** can also use **`GET /teachers/me/formations`** and related “me” routes (see §4.3).

---

## 3. Enrollments

An **enrollment** links `studentId` (`users.id` for `APPRENANT`) to `formationId`. Status enum: **`ENROLLED`** | **`CANCELLED`**. New self-enrollments are created as **`ENROLLED`** immediately. Unique `(studentId, formationId)` → duplicate → **`409`**.

### 3.1 Internal & external learners (same API)

Both use **`UserRole.APPRENANT`**. There is **no separate** enrollment endpoint by account type; identity is the JWT `sub` / user id.

| Method | Path | Role |
|--------|------|------|
| `POST` | `/enrollments` | `APPRENANT` |
| `GET` | `/enrollments/me/profile` | `APPRENANT` — **recommended** card list + `progressState` / bucket filter |
| `GET` | `/enrollments/me` | `APPRENANT` — deprecated raw rows; use `/me/profile` |
| `GET` | `/dashboard/student/overview` | `APPRENANT` — profile summary + `nextFormation` card |

Full contract: [learner-profile-api.md](learner-profile-api.md).

#### `POST /enrollments`

**Body:** `{ "formationId": "<uuid>" }`.

**Checks (order):** formation exists → `isSaleOpen` → not already enrolled → capacity (if `capacity` is set: count of `ENROLLED` must be `< capacity`; `null` capacity = unlimited).

**Success `201`:** `{ id, studentId, formationId, status, enrolledAt }`.

**Errors:**

| HTTP | Cause |
|------|--------|
| `404` | Formation not found |
| `400` | Sale closed, formation full, or invalid formation dates |
| `409` | Already enrolled |

**Side effect:** fire-and-forget enrollment notification (non-blocking; failures logged).

#### `GET /enrollments/me/profile`

Paginated enrollment **cards** (`bucket=IN_PROGRESS|COMPLETED|ALL`), with `progressState` and nested `formation` (+ `enrolledCount`, language, level). See [learner-profile-api.md](learner-profile-api.md).

#### `GET /dashboard/student/overview`

Profile **summary** counts (ENROLLED-only + certificates count) and optional **`nextFormation`** highlight. See [learner-profile-api.md](learner-profile-api.md).

#### `GET /enrollments/me`

**Query:** [`FindEnrollmentsQueryDto`](../src/modules/enrollments/dto/find-enrollments-query.dto.ts) — `page`, `limit` (1–100), `search`, `sortBy` (`enrolledAt` \| `status`), `sortOrder`, optional `status`, `formationId`.

**Response:** `PaginatedResponse<Enrollment>` — raw enrollment rows. For titles, also call **`GET /formations/:id`** per row (or use a dashboard endpoint that joins formations).

**Display hints:**

- **Internal student:** show `matricule` + name when present.
- **External learner:** often **`matricule` is null**; prefer **`email`** from the user profile / JWT context for display.

### 3.2 Teachers (read-only on enrollments module)

Teachers **do not** create enrollments via this API; they view learners enrolled in formations they teach.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/enrollments/teacher` | `ENSEIGNANT` | Paginated enrollments across **all** formations assigned to this teacher. Each item: `id`, `status`, `enrolledAt`, **`formation`** `{ id, title, startDate, endDate }`, **`student`** `{ id, firstName, lastName, email, matricule, identifierKind, identifier }`. `identifierKind` is `EMAIL`, `MATRICULE`, or `NONE` (derived from email vs matricule). |
| `GET` | `/enrollments/teacher/:enrollmentId` | `ENSEIGNANT` | One enrollment with **`enrollment`**, **`student`** (includes `accountType`, `bacYear`, `dob`, plus `identifierKind` / `identifier`), **`formation`** (with `language` / `level`), **`certificate`** (full row or `null`). **`404`** if enrollment does not exist or formation is not assigned to this teacher. |

**Per-formation lists** (alternative shape) live under **teachers**:

- `GET /teachers/me/formations/:formationId/enrollments` — paginated; each row: `id`, `studentId`, `status`, `enrolledAt`, `student` `{ id, firstName, lastName, matricule }`.

### 3.3 Admin (reference)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/enrollments` | ADMIN |
| `GET` | `/enrollments/formation/:formationId` | ADMIN |

See [enrollments-api.md](enrollments-api.md) for admin list limitations (raw rows, `search` behavior).

---

## 4. Certificates

At most **one certificate per enrollment** (`enrollment_id` unique). Deleting an enrollment cascades to its certificate.

### 4.1 Learners (internal & external)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/certificates/me` | `APPRENANT` |

**Query:** pagination: `page`, `limit`, optional `search` (**`ilike` on formation `title`**), `sortBy` (`issuedAt` \| `certificateNumber`), `sortOrder`.

**Each item:** `id`, `certificateNumber`, `verificationCode`, `issuedAt`, `pdfUrl`, **`formation`** `{ id, title, startDate, endDate }`, **`verificationUrl`** (path like `/api/v1/public/certificates/{verificationCode}` — prefix with your public API base for absolute links).

### 4.2 Admin

| Method | Path | Role |
|--------|------|------|
| `POST` | `/certificates/:enrollmentId/generate` | ADMIN |

**Behavior:** `404` if enrollment missing; `409` if certificate already exists. Issues `certificateNumber` (e.g. `CEIL-{year}-{4-hex}`) and `verificationCode` (64 hex chars). Returns the certificate row + `verificationUrl`.

**Note:** Current service does **not** require formation end date in the past or `ENROLLED` status — operational policy should gate when admins call this.

### 4.3 Public verification (no auth)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/public/certificates/:verificationCode` | None |

**Response `200`:** `{ status: 'VALID', certificateNumber, issuedAt, studentName, studentMatricule, formationTitle, teacherName, pdfUrl }`.  
`teacherName` is the **earliest-assigned** teacher for the formation (`formation_teachers.assigned_at`), or `null`.  
`404` if code unknown.

### 4.4 Teachers (certificates for one formation)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/teachers/me/formations/:formationId/certificates` | `ENSEIGNANT` |

Requires assignment to `formationId` (guard). **Pagination:** `page`, `limit` (+ optional `search` / `sortBy` on [`PaginationQueryDto`](../src/common/pagination/dto/pagination-query.dto.ts) — **sorting/filtering may be limited** depending on repository usage; list is ordered by **`issuedAt` desc** in the repository).

**Rows:** `id`, `enrollmentId`, `certificateNumber`, `verificationCode`, `issuedAt`, `pdfUrl` (no nested student in this endpoint; pair with enrollments list if needed).

---

## 5. End-to-end flows

### 5.1 External learner

1. `POST /auth/register` → JWT (`APPRENANT`).  
2. `GET /formations` → pick a formation with `isSaleOpen: true` and free capacity.  
3. `POST /enrollments` `{ formationId }`.  
4. After admin generates certificate: `GET /certificates/me` → share **`verificationUrl`** or public link.  
5. Third party: `GET /public/certificates/:verificationCode`.

### 5.2 Internal student

1. `POST /auth/login` with `loginType: STUDENT`, `bacYear`, `matricule`, `password`.  
2. Same formation browse and `POST /enrollments` / `GET /enrollments/me` / `GET /certificates/me` as external learner.

### 5.3 Teacher

1. `POST /auth/login` with `loginType: TEACHER`.  
2. `GET /teachers/me/formations` — assigned formations.  
3. `GET /enrollments/teacher` or `GET /teachers/me/formations/:formationId/enrollments` — roster.  
4. `GET /enrollments/teacher/:enrollmentId` — full detail + optional certificate.  
5. `GET /teachers/me/formations/:formationId/certificates` — certificates issued for that formation.

---

## 6. Common errors

| Code | Typical cause |
|------|----------------|
| `400` | Validation, closed sale, full formation |
| `401` | Missing/invalid JWT |
| `403` | Wrong role for route (e.g. teacher on `POST /enrollments`) |
| `404` | Resource not found or teacher not assigned to formation |
| `409` | Duplicate enrollment; certificate already generated |

---

## 7. Related docs

- [learner-profile-api.md](learner-profile-api.md) — APPRENANT profile overview + `/enrollments/me/profile`  
- [formations-api.md](formations-api.md) — admin DTOs, analytics status rules  
- [certificates-api.md](certificates-api.md) — extra security notes  
- [teachers-api.md](teachers-api.md) — full teacher CRUD & calendar  
- [business-use-cases-and-seed.md](business-use-cases-and-seed.md) — domain rules & seed data  

---

*UBMA CEIL — consolidated guide for learners (internal & external), formations browsing, enrollments, and certificates.*
