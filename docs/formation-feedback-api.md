# Formation feedback API

Canonical detail: **[FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md](./FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md)**

## Learner (`APPRENANT`)

| Method | Path | Body |
|--------|------|------|
| `PUT` | `/api/v1/formations/:id/feedback` | `{ rating: 0..5, comment?: string }` — upsert |
| `GET` | `/api/v1/formations/:id/feedback/me` | — |

Rules: must be **`ENROLLED`** in the formation. One feedback row per `(formationId, studentId)`. Comment max length validated in DTO (e.g. 2000 chars).

## Admin (`ADMIN`)

| Method | Path |
|--------|------|
| `GET` | `/api/v1/formations/:id/feedback` |

Query: standard pagination (`page`, `limit`). Returns list + **aggregate** (average, count, distribution).

## Privacy

Teacher aggregate comments omit email; admin list may include learner email for operations.
