
# Final Phase Plan — Production-Ready SMS

The scope you sent is very large (auth hardening + 4 new modules + reports + search + notifications + audit + polish). I'll deliver it in ordered milestones so each one is verifiable before moving on. Please confirm this order or tell me which milestones to reprioritize / drop.

## Milestone 1 — Portal isolation & login audit (do first, blocks everything else)

- **Public entry is `/student/login`.** `/` redirects to `/student/login`. Remove every visible link, button, or reference to staff/admin from public pages, footers, headers, and `index.tsx`.
- **Delete `/staff/login`** (legacy) and any redirect that exposes it. Only `/admin/login` remains — unlinked, `<meta name="robots" content="noindex,nofollow">`, excluded from any sitemap.
- **Audit login flow end-to-end** and fix:
  - Student login: Student ID + password → resolve to synthetic email server-side → `signInWithPassword`. Verify the synthetic-email mapping matches what `enrollStudent` writes.
  - Staff login: email + password.
  - Session persistence, `onAuthStateChange` in `__root.tsx`, bearer attacher in `src/start.ts`.
  - Role detection via `user_roles` + `has_role`/`is_staff`.
  - Post-login redirect: students → `/student`, staff → role dashboard. Wrong-portal login is rejected with a clear message (student credentials on `/admin/login` → refused, and vice-versa).
  - Initial admin seed still works; `change-password` flow forces rotation of temp passwords.
  - RLS spot-check on `profiles`, `students`, `user_roles`.

## Milestone 2 — Payments module

- Tables: `payments` (student, amount, currency, method, receipt_no, notes, operator, paid_at), `payment_plans` (monthly schedule per student), `discounts`.
- Server fns: `recordPayment`, `listStudentPayments`, `getOutstandingBalance`, `monthlyStatus`, `revenueStats`.
- Auto monthly status computed from plan + payments: Paid / Partial / Pending / Overdue / Cancelled.
- Admin **Payments dashboard**: today/month/year revenue, pending list, charts (Recharts), CSV export.
- Secretary "Register Payment" flow from reception + student profile.
- Student profile shows history + balance.

## Milestone 3 — Grades module

- Tables: `assessments` (course, group, teacher, type: exam/quiz/assignment/homework/practical, max_score, date), `grades` (assessment, student, score, comment).
- Server fns for teacher CRUD, student read-only.
- Auto stats per student: average, highest, lowest, trend.
- Teacher dashboard gets a Grades tab; student portal shows grades.

## Milestone 4 — Student portal completion

- `/student` shows: profile, avatar, QR, attendance %, attendance history, grades, average, payment history, outstanding balance, course, group, year, notifications.
- Student can update password + avatar only (Supabase Storage bucket `avatars`, RLS scoped to `auth.uid()`).
- Nothing else editable.

## Milestone 5 — Search + Notifications + Student Card

- Global staff search: student ID, name, phone, parent phone, course, group, QR token → instant results (debounced, indexed).
- Notifications table + realtime channel; toasts + bell menu; auto entries for attendance, payments, enrollment, errors.
- Printable **Student Card** (photo, name, ID, QR, course, group, logo) with A6 print CSS.

## Milestone 6 — Admin dashboard + Reports

- Redesigned admin home: KPIs (students, attendance %, revenue, pending), latest registrations, latest payments, charts, quick actions.
- Reports page: attendance / payments / students / teachers / grades / financial. Export CSV + Excel (`xlsx`) + PDF (`jspdf` + `jspdf-autotable`).

## Milestone 7 — Secretary dashboard rework

- First screen = 4 huge tiles: Scan QR, Register Student, Search Student, Payments. Keyboard shortcuts, one-click flow.

## Milestone 8 — Perf, security, QA audit

- Query indexes for search + attendance + payments.
- Route-level code-splitting review, image lazy-load, memoization on heavy lists.
- Security scan (`security--run_security_scan`), fix all findings, tighten RLS, verify QR token flow, add input validation with zod on every server fn.
- Manual QA pass: every route, CRUD, realtime, RTL, mobile viewport. Fix all issues.

## Technical notes

- New deps: `xlsx`, `jspdf`, `jspdf-autotable`, `recharts` (probably already present).
- New Supabase storage bucket: `avatars` (public read, owner write via RLS).
- All new tables get GRANTs + RLS in the same migration; staff via `is_staff`, students via `auth.uid()`.
- No breaking changes to existing tables; only additive columns if needed.

## Questions before I start

1. **Confirm milestone order** above, or tell me to reprioritize (e.g., Payments before Student Portal completion, or Auth-only this turn).
2. **Payment currency** — single currency (EGP?) or multi-currency support?
3. **Monthly fee source** — per-course fixed amount, per-group, or per-student override?
4. **Receipt numbers** — sequential per year (e.g. `2026-000123`) or free-form?

Reply with answers (or "proceed with defaults: EGP, per-course fee, sequential yearly receipts, do milestones in order") and I'll start executing Milestone 1 immediately.
