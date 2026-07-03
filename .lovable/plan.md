# Phase 1 — Foundations

Auth, roles, core entities, enrollment flow, and admin dashboard v1 for the Biology Education Center SMS. Later phases (QR/attendance, payments, grades, WhatsApp, reports) are out of scope for this plan.

## What you'll be able to do after Phase 1

- Sign up / log in as Administrator, Secretary, Teacher (real email) or Student (Student ID + password).
- Administrator manages: Academic Years, Courses, Groups, Teachers, Secretaries, Students, and can reset any user's password.
- Secretary enrolls a new Student — in one atomic action, the system creates the auth user, assigns the Student role, generates a unique `BIO-000001`-style Student ID, sets a temporary password, and links the student to an Academic Year + Course + Group.
- Teacher can search and view students (read-only in Phase 1 — grades/notes come in Phase 4).
- Student can log in and see a stub portal (full portal in Phase 4). Can change their profile picture and password.
- Admin dashboard v1: total students, today's attendance placeholder (real once Phase 2 lands), quick links to management screens.

Explicitly deferred: QR codes, attendance scanning, payments, grades, WhatsApp, PDF certificates, reports, Arabic strings, i18n library, activity log UI (schema included, UI in Phase 6).

## Architecture decisions (from our Q&A)

- **Backend**: Lovable Cloud (Supabase under the hood) — Postgres, Auth, RLS, Storage for profile pics.
- **Student login**: synthetic email `{studentid}@students.local` behind the scenes. Login form for students asks for Student ID + password; login form for staff asks for real email + password. Two entry points, one Supabase Auth backend.
- **Admin bootstrap**: manual. First signup is a normal user; you run a one-line SQL snippet in the Cloud SQL editor to grant admin. No hardcoded admin email in migrations.
- **RTL-safe layout only**: use Tailwind logical utilities (`ms-4`/`me-4`/`ps-2`/`pe-2`, `text-start`/`text-end`) throughout, wrap the app in a `<html dir>` context. No i18next in Phase 1 — strings stay English, extraction happens in Phase 6.
- **Roles in a separate `user_roles` table** with a `has_role()` security-definer function — required pattern for Lovable Cloud to avoid RLS recursion and privilege-escalation risk.

## Data model

New tables in the `public` schema (each with grants + RLS + policies):

```text
app_role                enum: admin | secretary | teacher | student
user_roles              (id, user_id → auth.users, role app_role, unique(user_id, role))
profiles                (id = auth.users.id, full_name, avatar_url, phone, created_at)
                        — one row per auth user, auto-created by trigger on signup
academic_years          (id, name e.g. "2025-2026", start_date, end_date, is_active)
courses                 (id, name, description, academic_year_id)
groups                  (id, name e.g. "Class 1A", course_id, academic_year_id, capacity)
teachers                (id, user_id → auth.users, specialization, hire_date)
secretaries             (id, user_id → auth.users, hire_date)
students                (id, user_id → auth.users, student_code "BIO-000001" unique,
                         date_of_birth, gender, student_phone, parent_phone,
                         email, address, academic_year_id, course_id, group_id,
                         status active|suspended, enrolled_at, enrolled_by)
student_code_seq        Postgres sequence, used by a SECURITY DEFINER function
                         `next_student_code()` returning "BIO-000001" formatted string
activity_log            (id, user_id, action, entity_type, entity_id, metadata jsonb,
                         ip_address, user_agent, created_at)
                        — schema only; UI in Phase 6
```

**RLS policy summary** (every user-facing table gets `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated` + `GRANT ALL TO service_role`, then RLS enabled):

- `user_roles`: read own; only admins can insert/update/delete (via `has_role(auth.uid(), 'admin')`).
- `profiles`: read own; admins read all; user updates own; admins update any.
- `academic_years`, `courses`, `groups`: all authenticated read; only admins write.
- `teachers`, `secretaries`: read all (authenticated); only admins write.
- `students`: admins + secretaries read all; teachers read all; a student reads only their own row (`user_id = auth.uid()`). Insert/update: admins + secretaries. Delete: admins only.
- `activity_log`: insert allowed for any authenticated user (their own actions); read only by admins.

## Auth flow

- **Staff signup/login** (`/auth`): real email + password. On signup, a trigger creates a `profiles` row. Role is assigned later by an admin (no self-service role assignment).
- **Student login** (`/student-login`): Student ID + password. Frontend converts `BIO-000123` → `bio-000123@students.local` before calling `supabase.auth.signInWithPassword`.
- **Enrollment (server function)**: `createServerFn` middleware `requireSupabaseAuth` + `has_role(...,'secretary' OR 'admin')` check. Inside handler, `supabaseAdmin` (loaded via `await import(...)`) does the privileged sequence:
  1. `next_student_code()` → `BIO-000042`
  2. `auth.admin.createUser({ email: 'bio-000042@students.local', password: <temp>, email_confirm: true })`
  3. Insert into `profiles`, `students`, `user_roles` (role=student)
  4. Return `{ student_code, temp_password }` to the secretary UI to display/copy
  All wrapped in a transaction pattern — if any step fails, the auth user is deleted to keep state consistent.
- **Admin bootstrap**: after your own signup, run in Cloud SQL editor:
  ```sql
  insert into public.user_roles (user_id, role)
  values ((select id from auth.users where email='you@example.com'), 'admin');
  ```

## Routing (TanStack Start)

Public:

- `/auth` — staff email/password (sign in + sign up)
- `/student-login` — Student ID + password

Protected under `src/routes/_authenticated/`:

- `/` after auth redirects by role: admin → `/admin`, secretary → `/secretary`, teacher → `/teacher`, student → `/student`
- `/admin` — dashboard v1 (KPI cards + quick links)
- `/admin/students`, `/admin/students/new`, `/admin/students/$id`
- `/admin/teachers`, `/admin/secretaries`
- `/admin/courses`, `/admin/groups`, `/admin/academic-years`
- `/secretary` — dashboard (enroll, search students)
- `/secretary/students/new` — enrollment wizard (shared component with admin)
- `/teacher` — student search (read-only)
- `/student` — stub portal (profile, change avatar/password)

Role gates in each subtree via `beforeLoad` checking `has_role` server-side.

## UI

- shadcn/ui components already in the template. Design system tokens in `src/styles.css` — I'll add a subtle biology-themed accent (deep teal/emerald primary, warm neutral surfaces) with light + dark mode both wired.
- All spacing/margins use logical utilities so a future `dir="rtl"` toggle Just Works.
- Forms via `react-hook-form` + `zod` (already patterns supported by shadcn `form.tsx`).

## Technical notes

- Uses the TanStack Start + Supabase integration patterns already in the project template (`_authenticated` layout is integration-managed, `requireSupabaseAuth` middleware, `attachSupabaseAuth` client-side).
- Enrollment logic lives in `src/lib/enrollment.functions.ts` (client-safe path, server-only imports inside `.handler()`).
- Storage bucket `avatars` (public read, owner write) for profile pictures.
- No Edge Functions yet — everything runs via `createServerFn`. Edge Functions come in Phase 5 for WhatsApp only.

## Out of scope (later phases)

QR generation & scanning, attendance, payments, grades, WhatsApp, PDF certificates, analytics charts, activity-log UI, Arabic strings + i18next, PWA manifest polish. Schema fields those phases need will be added in their own migrations, not now.               Two fixes before you build this: 1) Add an RLS policy on `profiles` allowing secretary/teacher/admin (via `has_role`) to read profiles of users linked to `students`, `teachers`, or `secretaries` rows they're authorized to view — right now only "read own" + "admin reads all" is defined, which blocks staff from seeing student/teacher names. 2) Give `secretary` insert/update rights on `groups` (not just admin) — secretaries need to create classes/groups per the spec, only `courses` should stay admin-only.