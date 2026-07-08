## Goal

Eliminate every dependency on `supabase.auth.admin.*` in this project so account creation works on Lovable Cloud (where the service-role key has data-plane rights but no Auth Admin privileges). Two flows to rebuild: student enrollment and staff invitations. Nothing else changes.

## Scope guardrails

Untouched: attendance, QR scanning, payments UI + server fns, catalogs, `_authenticated` gate, RLS policies, RTL/Arabic strings, existing route paths, `client.ts` / `client.server.ts` / `auth-middleware.ts` (auto-generated), the owner-protection trigger.

Shared code that must change (with reason):
- `src/lib/enrollment.functions.ts` — the `auth.admin.createUser` call is the bug; rewritten in place.
- `src/lib/staff.functions.ts` — the `auth.admin.inviteUserByEmail` call is the bug; replaced with token-invite fns.
- `src/components/staff-admin.tsx` — copy tweak only (message now says "invite link emailed", still calls one server fn).
- `src/routeTree.gen.ts` — auto-regenerates when the new route file is added.

No changes to `staff-admin.tsx`'s table columns, layout, or role logic.

## Prerequisite (must be true before starting)

1. Auth setting **Confirm email = disabled** on this project. Synthetic `@students.local` addresses can't receive mail, so `signUp` must return an immediately-usable session/user. Verified/toggled via `supabase--configure_auth` on the first build step.
2. Secret `RESEND_API_KEY` present in Lovable Cloud Secrets. If missing, request it via `add_secret` before shipping the invite flow.
3. A verified sender address in Resend (e.g. `no-reply@<verified-domain>`). Stored as secret `INVITE_FROM_EMAIL`; if the user hasn't verified a domain yet, fall back to Resend's `onboarding@resend.dev` sandbox address, which only delivers to the Resend account owner — that's enough for the required end-to-end test.

## Part 1 — Student enrollment (rewrite `enrollStudent`)

Replace the `auth.admin.createUser` block with an **isolated signUp** client created per call:

```text
enrollStudent (server fn, unchanged auth: admin/secretary only)
├─ reserve student_code via next_student_code() RPC   [unchanged]
├─ build one-off client:
│    createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
│      auth: { persistSession: false, autoRefreshToken: false, storage: undefined }
│    })
├─ isolatedClient.auth.signUp({ email: synthEmail, password: tempPassword,
│                               options: { data: { full_name, student_code } } })
│    → returns { user }; because "Confirm email" is off, user.id is usable immediately
├─ if signUp errors OR !user → throw with the literal Supabase error message
├─ profiles upsert  (via supabaseAdmin, RLS-bypass — data-plane, still works)
├─ user_roles insert  (student)
├─ students insert
├─ student_qr_tokens insert
└─ activity_log insert
```

Rollback on any downstream failure: since we can no longer delete the auth user (no admin API), if steps after signUp fail we mark the orphan row for cleanup by inserting into a new `orphan_auth_users(user_id, reason, created_at)` table and surface a clear error. This is documented — orphans don't break anything because there's no `user_roles` row for them; they simply can't log in.

## Part 2 — Staff invites (token flow)

### Database (one migration)

```sql
CREATE TYPE public.invite_status AS ENUM ('pending','accepted','expired','revoked');

CREATE TABLE public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  full_name text NOT NULL,
  role public.app_role NOT NULL CHECK (role IN ('admin','secretary','teacher')),
  specialization text,
  token_hash text NOT NULL UNIQUE,         -- sha256 of raw token; raw token never stored
  expires_at timestamptz NOT NULL,
  status public.invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.staff_invites TO authenticated;
GRANT ALL ON public.staff_invites TO service_role;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
-- Only admins can read/list invites; nobody can select via anon.
CREATE POLICY "admins read invites"   ON public.staff_invites FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins create invites" ON public.staff_invites FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update invites" ON public.staff_invites FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
```

Token validation and consumption run through `supabaseAdmin` in server fns, bypassing RLS — the anonymous acceptance page never queries this table directly.

### Server functions (`src/lib/staff-invites.functions.ts`)

- `inviteStaff({ email, full_name, role, specialization })` — admin-only. Generates a 32-byte URL-safe token, stores its SHA-256 hash with `expires_at = now() + 7 days`, then POSTs to Resend's REST API (`https://api.resend.com/emails`) using `RESEND_API_KEY`. Email body is Arabic + English with the acceptance URL `${origin}/accept-invite?token=<raw>`. Origin comes from the request headers, with `PUBLIC_SITE_URL` env override for reliability.
- `previewInvite({ token })` — public server fn (no auth middleware). Returns `{ email, full_name, role }` if the token hash matches, status is `pending`, and `expires_at > now()`. Otherwise returns a typed error (`expired | invalid | already_used`).
- `acceptInvite({ token, password })` — public server fn. Re-validates the token, then:
  1. Isolated anon client `auth.signUp({ email, password, options: { data: { full_name } } })`.
  2. On success, via `supabaseAdmin`: upsert `profiles`, insert `user_roles(role)`, and insert `teachers` or `secretaries` per role (unchanged from current `inviteStaff` shape).
  3. Mark invite `accepted`, set `accepted_user_id` + `accepted_at`.
  4. Return `{ ok: true }`. If signUp fails (e.g. email already an auth user), return the literal Supabase error message; invite stays pending so admin can retry / revoke.

The existing `inviteStaff` name and signature in `src/lib/staff.functions.ts` are replaced with the new implementation so `staff-admin.tsx` needs no wiring change beyond a copy tweak. `clearMustChangePassword` stays untouched.

### Acceptance route (`src/routes/accept-invite.tsx`)

Public route, `ssr: false`, mirrors the Arabic RTL styling of `admin.login.tsx`. Flow:

1. Reads `?token=` from search params. Calls `previewInvite`.
2. If invalid/expired → Arabic error card with "العودة لتسجيل الدخول" link to `/admin/login`.
3. If valid → shows the invitee's email + role and a form: new password + confirm (min 10 chars, same rule as `reset-password.tsx`).
4. Submits `acceptInvite`. On success, signs the user in with the same credentials (already signed in by signUp when confirm-email is off, so just `navigate({ to: "/" })`).
5. Any error → toast with the literal message.

## Part 3 — Verification (literal pass/fail, reported in the final message)

Driven via Playwright over `http://localhost:8080` using the already-injected admin session (`LOVABLE_BROWSER_AUTH_STATUS=injected`). Three test cases, each with a screenshot in `/tmp/browser/`:

1. **Enrollment E2E** — read `SELECT count(*) FROM students` before, run the secretary "new student" form via UI, read count after, then in a fresh incognito context log in at `/student/login` with the returned `BIO-XXXXXX` + temp password and confirm landing on `/student`.
2. **Staff invite E2E** — user provides a real inbox address they own (the Resend account owner's address, since we're on the sandbox sender). Fill invite form as admin → click the link that arrives → set a password → confirm redirect to `/` with the correct role dashboard visible.
3. **Wrong-password error** — on `/admin/login` and `/student/login`, submit deliberately wrong credentials, screenshot the visible Arabic toast to confirm it appears (not a blank screen).

Report format: `enrollment: PASS/FAIL — <literal outcome>`, `staff invite: PASS/FAIL — <literal outcome>`, `wrong password admin: PASS/FAIL`, `wrong password student: PASS/FAIL`. On any FAIL, include the literal Supabase/Resend error code and message; no paraphrasing, no retry loop.

## Technical notes for the implementer

- Isolated `signUp` client must be constructed **inside** the handler (not at module scope) so the split transform keeps it. Use `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` from `process.env` — never the secret key for signUp.
- Resend call uses `fetch` directly (`Authorization: Bearer ${RESEND_API_KEY}`, `Content-Type: application/json`). Do not add the `resend` npm package; the Worker runtime prefers plain fetch.
- Token hashing: `crypto.subtle.digest('SHA-256', ...)` + hex encode. Raw token only ever exists in the email URL and in the invitee's browser.
- Env reads for `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `PUBLIC_SITE_URL` must be inside `.handler()` bodies.
- No changes to the `_authenticated` gate — accepted invitees are simply routed to `/` and the existing gate handles role-based redirects.
- Migration includes the `citext` extension guard: `CREATE EXTENSION IF NOT EXISTS citext;`
- Do not delete or edit the existing `reset-password.tsx` / `change-password.tsx` flows; they remain the recovery path for existing accounts.

## Two things I need from you before build

1. Confirm the Resend sender address to use, or say "use sandbox" — in sandbox mode only the Resend account owner's email can receive invites, which limits the E2E test to that one address.
2. Confirm the email address you want to use as the invitee for the staff-invite E2E test.
