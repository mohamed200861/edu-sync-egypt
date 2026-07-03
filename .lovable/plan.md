## Scope

This message bundles what we previously separated as Phase 3 (QR + Scanner + Realtime) and Phase 4 (Attendance), plus a few smaller items (rename staff login to `/admin/login`, harder-to-guess Student IDs, rich enrollment summary + WhatsApp handoff, credentials always visible on student profile). I'll ship it as one phase since the pieces are tightly coupled — the scanner is useless without QR, the reception popup is useless without realtime, and both feed the attendance table.

Payments, grades, profile pictures, reports/analytics stay for later phases as previously agreed.

## What gets built

### 1. Auth surface cleanup
- Rename `/staff/login` → `/admin/login`. Old path 301s to new one so nothing breaks.
- No shared layout between student and staff login (already true; verify).

### 2. Student ID format change
- Switch from `BIO-000042` sequential to `BIO-XXXXXX` with a Crockford-base32 alphabet (no confusable chars: no `I O 0 1`), generated server-side with collision retry.
- Keep the existing `students.student_code` column; only the generator changes. Existing IDs stay valid.

### 3. QR code system
- New `student_qr_tokens` table: `student_user_id`, `token` (opaque random 32-byte base64url), `active`, timestamps. Unique active token per student. Rotatable.
- Server fn `issueStudentQrToken` (admin/secretary): generates + stores.
- Server fn `resolveStudentQrToken` (staff): token → student summary (name, code, course, group, today's attendance, attendance %, payment status placeholder).
- QR payload = the opaque token only. No PII, no student code embedded.
- Client renders QR with `qrcode` npm package (SVG, printable).

### 4. Enrollment summary + delivery
- After `enrollStudent` succeeds, redirect to a summary screen showing: name, Student ID, temp password, QR (large, printable), course/group/year, and action buttons: Print QR Card, Download QR (PNG), Copy ID, Copy Password, Open Profile, WhatsApp handoff (prefilled Arabic message via `wa.me/?text=`), Print Credentials.
- Temp password remains visible to admin/secretary on the student profile until the student changes it (already tracked via `profiles.must_change_password`); after change, show "تم التغيير" instead of the password.

### 5. Scanner page (`/secretary/scanner`, also linked from admin)
- Uses `@zxing/browser` to read QR from: rear/front camera on mobile, webcam on desktop, and USB HID readers (which act as keyboards — a hidden input captures the string). Same page, auto-detects.
- On scan → calls `resolveStudentQrToken` → broadcasts via Supabase Realtime `broadcast` channel `reception` with `{ student_user_id, scanned_at }`.

### 6. Reception live view (`/secretary/reception`)
- Subscribes to the `reception` broadcast channel. On event, fetches the student summary and opens a modal with: photo placeholder, name, ID, course, group, today's attendance, attendance %, average grade (placeholder), payment status (placeholder), latest payment (placeholder), and buttons: Confirm Attendance, Register Payment (disabled — later phase), View Profile, Close.

### 7. Attendance module
- New tables:
  - `attendance_settings` (singleton row): `mode` = `auto` | `manual`. Admin-editable.
  - `attendance` : `student_user_id`, `course_id`, `group_id`, `teacher_id` (nullable), `attended_on` (date), `attended_at` (timestamptz), `status` (`present` | `late` | `absent`), `type` (`auto` | `manual`), `device` (`mobile` | `webcam` | `usb` | `manual`), `operator_id`. Unique index on `(student_user_id, attended_on)` blocks duplicates.
  - RLS: staff read/insert; students read own only. No deletes for anyone (no DELETE policy).
- On QR scan:
  - `auto` mode → row inserted immediately by the resolver server fn.
  - `manual` mode → "Confirm Attendance" button on reception popup inserts the row.
- Attendance dashboard (`/admin/attendance` + link from secretary): today's count, week/month totals, absent list, late list, small chart (recharts is already in shadcn), per-group percentage.

### 8. Speed polish
- Preload `/secretary/students/new` and `/secretary/scanner` on secretary dashboard hover.
- Reception page auto-focuses hidden input on mount for USB scanner use.

## Technical notes

- **New deps**: `qrcode` (SVG QR render), `@zxing/browser` (+ `@zxing/library`) for camera scanning. Both are pure JS, Worker-safe (only used in the browser anyway).
- **Realtime**: use Supabase `broadcast` channel (not postgres_changes) — lower latency, no table churn, no RLS lookup on every event. Both scanner and reception subscribe.
- **QR token security**: opaque 32-byte random, stored server-side; resolver requires staff role. Rotating a token invalidates the old QR (needed if a phone is lost). No student PII in the QR itself.
- **Attendance uniqueness**: enforced by unique index, not app logic, so races can't create dupes. Insert catches unique-violation and returns "already recorded today".
- **Grants**: every new public table gets explicit GRANTs alongside the RLS policies (per project convention).

## Explicitly out of scope this phase
- Payments module (Phase 5)
- Grades module (Phase 6)
- Profile pictures (Phase 6)
- Reports/analytics/activity-log UI (Phase 7)
- Actual WhatsApp API send — only prefilled `wa.me` handoff for now, as requested

## Rollout order inside the phase
1. Migration: rename generator, QR tokens table, attendance tables + settings, RLS + grants.
2. Server fns: token issue/resolve, attendance insert, settings read/write.
3. Enrollment summary page + WhatsApp handoff.
4. Scanner page.
5. Reception page + realtime.
6. Attendance dashboard.
7. `/admin/login` rename + redirect.

Confirm and I'll start with the migration.