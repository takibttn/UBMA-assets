# Teachers entity migration — before & after

This document describes the refactor that **splits teachers out of the `users` table** into a dedicated **`teachers`** model, while keeping **formation assignment and teacher-facing APIs** compatible via JWT `role: "ENSEIGNANT"` and the same route shapes.

---

## How it was (before)

### Data model

- **Teachers** were rows in **`users`** with **`role = 'ENSEIGNANT'`**.
- They shared the same columns as learners and admins: `bac_year`, `matricule`, `account_type`, `dob`, etc. (often unused for teachers).
- **`formation_teachers.teacher_id`** referenced **`users.id`** (ON DELETE CASCADE).

### Auth

- Teachers logged in with the **same** `POST /auth/login` modes as learners:
  - **`loginType: "EMAIL"`** + password against `users.email`, or
  - In theory matricule-based login if a teacher row had matricule populated.
- JWT payload: `{ sub: users.id, role: "ENSEIGNANT" }`.

### Admin operations

- **No** dedicated “create teacher” API on the teachers controller; provisioning was usually via **`users`** creation with `role: ENSEIGNANT` (or manual DB seed).
- **`GET /teachers`** listed **`users`** filtered by `role = ENSEIGNANT` (included `bacYear`, `matricule`, `role` in list items).

### Enrollments & assignments

- **Learner enrollment** (`enrollments.student_id`) always pointed to **`users.id`** — unchanged conceptually after migration.
- **Teaching assignment** linked **`formation_teachers.teacher_id`** to **`users.id`**.

### Dashboard / analytics

- Counts such as “total teachers” / legacy admin stats used **`users` WHERE role = ENSEIGNANT`**.
- **Top teachers** ranked **`users`** joined with **`formation_teachers`**.

---

## How it is now (after)

### Data model

- New table **`teachers`** with **only**:
  - `id` (uuid)
  - `first_name`, `last_name`
  - `email` (**unique**, not null, lowercased on write)
  - `password` (bcrypt hash)
  - `created_at`, `updated_at`
- **`users.role`** enum in PostgreSQL is **`('ADMIN', 'APPRENANT')` only** — **`ENSEIGNANT` removed** from `users`.
- **`formation_teachers.teacher_id`** references **`teachers.id`** (ON DELETE CASCADE).
- **`assigned_by_id`** still references **`users.id`** (admin who performed the assignment).

### Database migration (`drizzle/0001_teachers_entity.sql`)

1. **`CREATE TABLE teachers`**.
2. **Copy** every **`users`** row with **`role = ENSEIGNANT`** into **`teachers`**, **preserving the same `id`** so existing `formation_teachers.teacher_id` values stay valid when the foreign key is repointed.
3. **Synthetic email** if a legacy teacher had `email` NULL:  
   `teacher-{uuid-no-dashes}@migrated.ubma.invalid`
4. **`formations.creator_id`** set to **NULL** when it pointed at an ENSEIGNANT user (creators are admins in normal operation).
5. Drop FK **`formation_teachers_teacher_id_users_id_fk`**, add FK **`formation_teachers_teacher_id_teachers_id_fk`**.
6. **Delete** migrated rows from **`users`** (`role = ENSEIGNANT`).
7. **Shrink `role` enum** to **`ADMIN` / `APPRENANT`**.

### Auth

- **Teachers** use **`POST /auth/login`** with:
  - **`loginType: "TEACHER"`**
  - **`email`** + **`password`**
  - Credentials are checked against **`teachers`** (bcrypt).
- JWT payload: **`{ sub: teachers.id, role: "ENSEIGNANT" }`** — same **`role` string** as before so **`@Auth(UserRole.ENSEIGNANT)`** is unchanged.
- **`user` object in login response** for teachers:  
  `accountType: null`, `email` set from **`teachers.email`**.

Learners keep **`STUDENT`** / **`EMAIL`** login types against **`users`**.

### Admin operations

- **`POST /teachers`** (ADMIN): create a teacher with **`CreateTeacherDto`** (`firstName`, `lastName`, `email`, `password`).
- **`GET /teachers`** lists **`teachers`** (items: `id`, `firstName`, `lastName`, `email`, `createdAt`).
- **`users`** creation (`CreateUserDto`) is restricted to **`ADMIN` / `APPRENANT`** only; **`ENSEIGNANT`** is rejected (teachers must use **`POST /teachers`**).

### Enrollments & assignments (unchanged behavior)

- **Learners** still **`POST /enrollments`** as **`APPRENANT`**; **`enrollments.student_id`** still **`users.id`**.
- **Teaching** is still **`POST /teachers/:teacherId/formations/:formationId`**; **`teacherId`** is now **`teachers.id`** (same UUIDs after migration for existing data).
- **`GET /enrollments/teacher`** still uses **`formation_teachers`**; the JWT **`sub`** is a **teacher id**.

### Code touchpoints (reference)

| Area | Change |
|------|--------|
| `src/db/schema.ts` | `teachers` table; `formationTeachers.teacherId` → `teachers`; `role` enum without ENSEIGNANT on users |
| `src/modules/teachers/teachers.repository.ts` | CRUD/list/stats against `teachers` |
| `src/modules/teachers/teacher-assignments.service.ts` | Validates id exists in `teachers` |
| `src/modules/auth/auth.service.ts` | `LoginType.TEACHER`; `TeachersRepository.findByEmail` |
| `src/modules/auth/auth.module.ts` | Imports `TeachersModule` |
| `src/lib/repositories/dashboard/dashboard.repository.ts` | Teacher counts / top teachers from `teachers` |
| `src/lib/repositories/certificates/certificates.repository.ts` | `findTeacherByFormationId` joins `teachers` |
| `src/db/seed.ts` | Seeds **`teachers`** (e.g. `teacher.one@seed.ubma.test`) instead of ENSEIGNANT `users` |

### Frontend checklist

1. **Teacher login:** send **`loginType: "TEACHER"`** with email + password; store JWT as today.
2. **Teacher `sub`:** still a UUID — now **`teachers.id`**, not **`users.id`** (same value for migrated rows).
3. **Admin teacher list/detail:** use **`email`** instead of matricule/bacYear/role fields on list items.
4. **Create teacher:** call **`POST /teachers`**, not user provisioning with ENSEIGNANT.

---

## Optional follow-ups

- **Email uniqueness across `users` and `teachers`:** not enforced globally; same string could exist in both tables — validate in app if needed.
- **Password reset / invite flow** for teachers.
- **Notifications:** wire **`teacherEmail`** from **`teachers.email`** when notifying on enrollment.

---

*UBMA CEIL — teachers entity migration summary.*
