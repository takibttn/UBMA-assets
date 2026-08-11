# Certificates API

Reference for certificate **generation** (admin), **learner listing** (apprenant), and **public verification**. All paths assume the app global prefix **`/api/v1`** (see `main.ts`).

---

## 1. Overview

A **certificate** is a row linked **1:1** to an `enrollment` (`enrollment_id` is unique). When generated, the API assigns:

- `certificateNumber` — human-readable, e.g. `CEIL-{year}-{4-hex}` (current implementation uses 2 random bytes → 4 hex chars)
- `verificationCode` — 64-char hex string (32 random bytes), unique, used in the public URL
- `issuedAt` — issuance timestamp
- `pdfUrl` — optional; not set by `generate` today (nullable in DB)

The certificates module exposes three HTTP entry points. **Teachers** can list certificates for a formation they teach via [`/teachers/me/formations/:formationId/certificates`](teachers-api.md) (see [Teachers API](teachers-api.md)).

---

## 2. Domain model (database)

Inferred from [`src/db/schema.ts`](src/db/schema.ts):

```ts
type Certificate = {
  id: string;                    // uuid
  enrollmentId: string;          // uuid, unique FK -> enrollments.id (cascade delete)
  certificateNumber: string;     // unique, max 50
  verificationCode: string;      // unique, max 64
  issuedAt: Date | string;       // timestamp
  pdfUrl: string | null;         // optional storage URL
};
```

**Constraints:**

- One certificate per enrollment (`enrollment_id` unique).
- `certificate_number` and `verification_code` are globally unique.
- Deleting an enrollment deletes its certificate (cascade).

---

## 3. Auth matrix

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/certificates/:enrollmentId/generate` | `ADMIN` only |
| `GET` | `/certificates/me` | `APPRENANT` only |
| `GET` | `/public/certificates/:verificationCode` | **None** (public) |

Other roles on protected routes → **403**. Missing/invalid JWT on protected routes → **401**.

---

## 4. Shared types

### 4.1 Pagination query — `FindMyCertificatesQueryDto`

Extends [`PaginationQueryDto`](src/common/pagination/dto/pagination-query.dto.ts):

```ts
type FindMyCertificatesQueryDto = {
  page: number;              // default 1
  limit: number;             // default 10, max 100
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc'; // default 'desc'
};
```

**Behavior for `GET /certificates/me`:**

- When `search` is set: `ilike` on **formation title** (`%search%`).
- Default sort: `issuedAt` (or `certificateNumber` if `sortBy` is `certificateNumber`).

### 4.2 Pagination envelope — `PaginatedResponse<T>`

```ts
type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};
```

---

## 5. Endpoints

### 5.1 `POST /certificates/:enrollmentId/generate`

**Auth:** `ADMIN`

**Path params:**

```ts
type GenerateCertificateParams = {
  enrollmentId: string; // uuid
};
```

**Business logic (current implementation):**

1. Load enrollment by id → **404** if missing.
2. If a certificate already exists for this enrollment → **409** `Certificate already generated for this enrollment`.
3. Otherwise insert a new certificate with:
   - `certificateNumber = CEIL-{currentYear}-{random 4 hex uppercase}`
   - `verificationCode = random 32 bytes as hex` (64 chars)
4. Returns the persisted row plus a **relative** verification URL string.

**Important:** The service does **not** currently enforce:

- `enrollment.status === ENROLLED`
- Formation end date in the past

Admins should only generate when business rules are met (e.g. formation finished); tightening validation can be added later.

**Response `201` — `GenerateCertificateResponse`:**

```ts
type GenerateCertificateResponse = Certificate & {
  verificationUrl: string; // e.g. "/api/v1/public/certificates/{verificationCode}"
};
```

Where `Certificate` in JSON is roughly:

```json
{
  "id": "uuid",
  "enrollmentId": "uuid",
  "certificateNumber": "CEIL-2026-A3F2",
  "verificationCode": "64-hex-characters",
  "issuedAt": "2026-05-01T10:00:00.000Z",
  "pdfUrl": null,
  "verificationUrl": "/api/v1/public/certificates/64-hex-characters"
}
```

**Errors:**

| Code | When |
|------|------|
| `404` | Enrollment not found |
| `409` | Certificate already exists for enrollment |

---

### 5.2 `GET /certificates/me`

**Auth:** `APPRENANT`

**Query:** `FindMyCertificatesQueryDto`

**Response `200`:** `PaginatedResponse<MyCertificateListItem>`

Each list item shape (after service maps `verificationUrl`):

```ts
type MyCertificateListItem = {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt: string;
  pdfUrl: string | null;
  formation: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
  };
  verificationUrl: string; // "/api/v1/public/certificates/{verificationCode}"
};
```

**Example:**

```json
{
  "data": [
    {
      "id": "…",
      "certificateNumber": "CEIL-2026-A3F2",
      "verificationCode": "ab12…",
      "issuedAt": "2026-05-01T10:00:00.000Z",
      "pdfUrl": null,
      "formation": {
        "id": "…",
        "title": "Anglais B2",
        "startDate": "2026-01-10T08:00:00.000Z",
        "endDate": "2026-04-20T18:00:00.000Z"
      },
      "verificationUrl": "/api/v1/public/certificates/ab12…"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
}
```

**Notes:**

- Only certificates for enrollments belonging to the authenticated learner are returned (via `studentId = user.id`).
- **External learners** have `matricule` null in other endpoints; list items here do not repeat student fields (learner is implicit).

---

### 5.3 `GET /public/certificates/:verificationCode`

**Auth:** **none** (intended for QR codes / public verify page)

**Path params:**

```ts
type VerifyParams = {
  verificationCode: string; // 64-char hex in normal operation; no format validation in controller
};
```

**Response `200` — `PublicCertificateVerificationDto`:**

```ts
type PublicCertificateVerificationDto = {
  status: 'VALID';
  certificateNumber: string;
  issuedAt: string;
  studentName: string;           // firstName + space + lastName
  studentMatricule: string | null; // null for external learners
  formationTitle: string;
  teacherName: string | null;    // first assigned teacher by assignedAt, or null
  pdfUrl: string | null;
};
```

**Example:**

```json
{
  "status": "VALID",
  "certificateNumber": "CEIL-2026-A3F2",
  "issuedAt": "2026-05-01T10:00:00.000Z",
  "studentName": "Ada Lovelace",
  "studentMatricule": "202236101",
  "formationTitle": "Anglais B2",
  "teacherName": "Nadia Benali",
  "pdfUrl": null
}
```

**Errors:**

| Code | When |
|------|------|
| `404` | Unknown `verificationCode` |

**Teacher name rule:** The repository loads the **first** teacher for the formation ordered by `formation_teachers.assigned_at` ascending (earliest assignment). If no teacher is assigned, `teacherName` is `null`.

---

## 6. Related APIs (not in this controller)

| Use case | Endpoint | Doc |
|----------|-----------|-----|
| Teacher lists certs for a formation | `GET /teachers/me/formations/:formationId/certificates` | [Teachers API](teachers-api.md) |
| Admin “certificates to generate” KPI | `GET /dashboard/admin/stats` / alerts | [Admin dashboard API](admin-dashboard-api.md) |

Repository method `findByFormationPaginated` exists for admin-style formation certificate lists but is **not** exposed on `CertificatesController` today; teachers use the teachers module.

---

## 7. Security & integration notes

1. **`verificationCode` is a secret capability URL** — treat shared links like passwords; avoid logging full codes in client analytics.
2. **`verificationUrl` returned by the API is a path-only string** — prefix with your public API base (e.g. `https://api.example.com`) for absolute links in emails or PDFs.
3. **Public**: No rate limiting is documented in this repo; add at gateway if abuse is a concern.
4. **Generate**: Only `ADMIN`; consider auditing who generated which certificate in a future table/log.
5. **`pdfUrl`**: Reserved for future PDF storage integration; generation flow does not upload files yet.

---

## 8. Type summary (quick reference)

```ts
// DB insert (internal)
type NewCertificate = {
  enrollmentId: string;
  certificateNumber: string;
  verificationCode: string;
  pdfUrl?: string | null;
};

// POST generate response
type GenerateCertificateResponse = Certificate & { verificationUrl: string };

// GET /certificates/me item
type MyCertificateListItem = { /* section 5.2 */ };

// GET /public/certificates/:code
type PublicCertificateVerificationDto = { /* section 5.3 */ };
```

---

*Generated for UBMA CEIL — certificates module API contract.*
