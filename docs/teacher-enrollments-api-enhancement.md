# Teacher enrollments API — migration context & new contract (LLM / client)

This document describes **only** the **enseignant-related enrollments API** as implemented after the teachers refactor and the **list + detail** enhancement. Use it to sync a client with `GET /enrollments/teacher` and **`GET /enrollments/teacher/:enrollmentId`**.

**Base URL example:** `http://localhost:3200/api/v1` (prefix depends on your Nest global prefix).

---

## 1. Migration context (why JWT `sub` is not a `users` id)

| Before | After |
|--------|--------|
| Teachers were **`users`** with `role = ENSEIGNANT`. | Teachers live in **`teachers`**; learners stay in **`users`** (`APPRENANT` / `ADMIN`). |
| JWT `sub` could be a user id for a teacher. | For **`ENSEIGNANT`**, **`sub` = `teachers.id`** (UUID). |
| `enrollments.student_id` still points to **`users.id`**. | Unchanged — students are always **`users`**. |

**Teaching scope:** A teacher sees enrollments only if there is a row in **`formation_teachers`** linking their **`teachers.id`** to the enrollment’s **`formation_id`**.

---

## 2. Student “identifier” rule (shared)

Computed on the server for both list and detail:

| Priority | `identifierKind` | `identifier` |
|----------|------------------|--------------|
| Non-empty **email** (trimmed) | `EMAIL` | email lowercased |
| Else non-empty **matricule** (trimmed) | `MATRICULE` | matricule as stored |
| Else | `NONE` | `""` |

Raw **`email`** and **`matricule`** are still returned so the client can show full context (e.g. internal vs external learners).

---

## 3. `GET /enrollments/teacher` (list) — **new contract**

**Auth:** `Bearer` token, JWT role **`ENSEIGNANT`**.

### Query (`FindEnrollmentsQueryDto`)

| Param | Type | Behaviour |
|-------|------|-----------|
| `page` | int | Default `1`, min `1` |
| `limit` | int | Default `10`, min `1`, max `100` |
| `formationId` | uuid (optional) | **Filters** enrollments to that formation only. If you are not assigned to that formation, you get **no rows** (empty page), not an error. |
| `status` | `ENROLLED` \| `CANCELLED` (optional) | Filters by enrollment status |
| `search` | string (optional) | Case-insensitive (`ilike`) on formation **title**, enrollment **status** text, student **firstName**, **lastName**, **email**, **matricule** |
| `sortBy` | string (optional) | Only **`enrolledAt`** and **`status`** are honored; default **`enrolledAt`** |
| `sortOrder` | `asc` \| `desc` | Default **`desc`** |

### Business logic (summary)

- Join: **`enrollments` → `users` (student) → `formations` → `formation_teachers`** with **`formation_teachers.teacher_id = JWT sub`**.
- One row per enrollment (unique assignment per teacher–formation pair).
- No duplicate enrollments from multiple teachers on the same formation for a single teacher query.

### Response: `PaginatedResponse<TeacherEnrollmentListItem>`

```http
200 OK
```

```json
{
  "data": [
    {
      "id": "enrollment-uuid",
      "status": "ENROLLED",
      "enrolledAt": "2026-04-01T10:00:00.000Z",
      "formation": {
        "id": "formation-uuid",
        "title": "Anglais niveau B1",
        "startDate": "2026-05-01T08:00:00.000Z",
        "endDate": "2026-07-15T18:00:00.000Z"
      },
      "student": {
        "id": "user-uuid",
        "firstName": "Samir",
        "lastName": "Meziani",
        "email": "samir@example.com",
        "matricule": "20201234",
        "identifierKind": "EMAIL",
        "identifier": "samir@example.com"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### TypeScript — list item

```ts
type TeacherEnrollmentListItem = {
  id: string;
  status: 'ENROLLED' | 'CANCELLED';
  enrolledAt: string;
  formation: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    matricule: string | null;
    identifierKind: 'EMAIL' | 'MATRICULE' | 'NONE';
    identifier: string;
  };
};

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```

### Breaking changes (client migration checklist)

- **Removed** from each list element: top-level **`studentId`**, **`formationId`** (use **`student.id`**, **`formation.id`**).
- **Added:** nested **`student`** (with name + identifier fields) and **`formation`** (title + dates).
- **`formationId` query param** is now **applied** (previously documented as ignored; implementations must align).

---

## 4. `GET /enrollments/teacher/:enrollmentId` (detail) — **new endpoint**

**Auth:** `ENSEIGNANT`.

### Behaviour

- Loads the enrollment with **student**, **formation** (including language & level), and **optional certificate** (left join).
- **Authorized** only if there exists **`formation_teachers (teacher_id = JWT sub, formation_id = enrollment.formation_id)`**.
- If not found or not authorized → **`404`** with message **`Enrollment not found or inaccessible`** (no **403** to avoid leaking ids).

### Response `200`

```ts
type TeacherEnrollmentDetailResponse = {
  enrollment: {
    id: string;
    studentId: string;
    formationId: string;
    status: 'ENROLLED' | 'CANCELLED';
    enrolledAt: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    matricule: string | null;
    identifierKind: 'EMAIL' | 'MATRICULE' | 'NONE';
    identifier: string;
    accountType: 'INTERNAL_STUDENT' | 'EXTERNAL_LEARNER';
    bacYear: number | null;
    dob: string | null;
  };
  formation: {
    id: string;
    title: string;
    description: string | null;
    price: string | null;
    capacity: number | null;
    isSaleOpen: boolean;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    language: { id: string | null; name: string | null; code: string | null };
    level: { id: string | null; code: string | null; name: string | null };
  };
  certificate: null | {
    id: string;
    enrollmentId: string;
    certificateNumber: string;
    verificationCode: string;
    issuedAt: string;
    pdfUrl: string | null;
  };
};
```

### Route ordering

Declared **after** `GET /enrollments/teacher` so the static segment `teacher` is not captured as a UUID param.

---

## 5. Comparison with `GET /teachers/me/formations/:formationId/enrollments`

| Feature | `/enrollments/teacher` | `/teachers/me/formations/:formationId/enrollments` |
|---------|-------------------------|-----------------------------------------------------|
| Scope | All taught formations | **One** formation (guard) |
| List shape | Nested student + formation summary | `student` includes **no email** in repository today; has **studentId** top-level |
| Pagination | Full `PaginationQueryDto` in controller | **Only `page` / `limit`** used server-side |
| Use case | Global “my students” table | Formation classroom roster |

Clients can prefer **`/enrollments/teacher`** for a **consistent** student profile (email + identifier) and use the detail endpoint for a **single-row drill-down**.

---

## 6. Errors

| Status | When |
|--------|------|
| `401` | Missing / invalid JWT |
| `404` | `GET .../teacher/:enrollmentId` — not found or not your formation |

---

## 7. Source files (server)

- `src/modules/enrollments/enrollments.controller.ts` — routes
- `src/modules/enrollments/enrollments.service.ts` — list mapping + detail orchestration
- `src/lib/repositories/enrollments/enrollments.repository.ts` — SQL (`findForTeacherPaginated`, `findEnrollmentDetailForTeacher`)
- `src/modules/enrollments/utils/student-identifier.util.ts` — `identifier` / `identifierKind`

---

*UBMA CEIL — teacher enrollments API (post–teachers-table migration + list/detail enhancement).*
