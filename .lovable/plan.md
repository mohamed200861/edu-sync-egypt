## Scope

Four fixes, each proven with live queries/tests. No prose-only "done" claims.

---

### 1. Rewrite `enrollStudent` off `auth.admin.createUser`

**File:** `src/lib/enrollment.functions.ts`

- Remove the `supabaseAdmin.auth.admin.createUser` call.
- Inside the handler, build an **isolated anon-key Supabase client** (no session persistence, no shared storage) using `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`, and call `.auth.signUp({ email: synthEmail, password: tempPassword, options: { data: { full_name, student_code } } })`.
- Keep the rest of the flow on `supabaseAdmin` (profile upsert, role insert, students insert, QR token, activity log). Rollback path on failure: since we can't delete an auth user without admin API, on downstream failure we mark the profile/student as `status='failed'` and log — no orphan auth user cleanup attempt.
- Auto-confirm is already enabled in `supabase/config.toml`, so `signUp` returns a usable session/user immediately.

**Proof:**
- `SELECT COUNT(*) FROM public.students` before.
- Run one enrollment through the secretary UI via Playwright.
- `SELECT COUNT(*) FROM public.students` after (+1), plus `SELECT student_code, user_id FROM public.students ORDER BY created_at DESC LIMIT 1`.
- Playwright: sign out, go to `/student/login`, enter the returned BIO code + temp password, screenshot the authenticated student dashboard.

---

### 2. Staff invites via `staff_invites` + Resend + `/accept-invite`

**Migration** — new table:
```
public.staff_invites(
  id uuid pk,
  email citext not null,
  full_name text not null,
  role app_role not null check (role in ('admin','secretary','teacher')),
  specialization text,
  token_hash text not null unique,        -- sha256 of the URL token
  invited_by uuid references auth.users,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
)
```
GRANT to `service_role` only (no `authenticated` / `anon`). RLS enabled with no permissive policies — all access goes through server functions using `supabaseAdmin`.

**Server functions** (`src/lib/staff.functions.ts`):
- `inviteStaff` (admin-only, replaces the `inviteUserByEmail` call): generate 32-byte random token, store `sha256(token)` in the row, email the recipient a link `${PUBLIC_SITE_URL}/accept-invite?token=<raw>` via Resend (`RESEND_API_KEY`, `INVITE_FROM_EMAIL`).
- `acceptInvite` (unauthenticated, rate-limited by token): validates token hash + expiry + not-accepted, creates the auth user via the same isolated-anon-client `.auth.signUp` pattern with a user-provided password, then inserts profile + role + teacher/secretary row, marks invite accepted. **Returns `{ email }` only** — does not attempt to hand a server-side session to the browser. The `/accept-invite` route then redirects to `/admin/login?invited=1` with a toast "Account created — sign in with your new password".

**Route:** `src/routes/accept-invite.tsx` — public route, reads `?token=`, renders a "Set your password" form, calls `acceptInvite`, on success navigates to `/admin/login`.

**Secrets needed:** `RESEND_API_KEY`, `INVITE_FROM_EMAIL` (verified sender), `PUBLIC_SITE_URL`. Will request via `add_secret` at the start of build mode.

**Proof:**
- `SELECT COUNT(*) FROM public.staff_invites` before/after.
- Ask the user for a real recipient email (the earlier "[la tua email]" was literal placeholder text — needs a real address to send to).
- Send the invite, user clicks link, sets password, Playwright then logs in at `/admin/login` with that email + new password, screenshot the admin dashboard.
- `SELECT accepted_at FROM public.staff_invites WHERE email=...` confirms non-null.

---

### 3. Redact the plaintext admin password from the bootstrap migration

**File:** `supabase/migrations/20260703100944_*.sql`

- Replace the `v_password text := 'mohamed 2009';` literal with a comment block explaining the original credential was rotated via the "Forgot password" flow and no live secret sits in git history from this point forward.
- Also replace the raw `INSERT INTO auth.users ... crypt(...)` block: gate it behind `IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email)` (it already is) AND make the password a randomly-generated one-time value using `gen_random_uuid()::text` so the migration is still idempotent for fresh databases but never contains a known credential. Document in a comment that the admin must immediately use "Forgot password" on first setup.
- Note: this does not rewrite git history. The literal `mohamed 2009` remains in past commits — the user must consider that password permanently burned and rotate it in the live DB if they haven't already. Will state this explicitly in the report.

**Proof:**
- `grep -n "mohamed" supabase/migrations/` returns nothing.
- `grep -n "crypt(" supabase/migrations/` shows only the randomized-password branch.

---

### 4. RLS on `realtime.messages` for the reception/scanner topic

**Migration:**
```sql
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;  -- if not already

CREATE POLICY "scanner_broadcast_insert"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    extension = 'broadcast'
    AND topic IN ('reception', 'scanner')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary'))
  );

CREATE POLICY "scanner_broadcast_select"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND topic IN ('reception', 'scanner')
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'secretary')
      OR public.has_role(auth.uid(), 'teacher')
    )
  );
```

Client channels stay named `reception` / `scanner`; no client code change needed unless the current channel name differs — will verify by reading `reception.tsx` and `qr-scanner.tsx` first and align policy topics to actual names.

**Caveat to surface honestly:** the top-level instructions say "Never touch schemas: auth storage realtime …". This task explicitly overrides that for the `realtime.messages` policies. Will call this out in the migration description so the user approves the exception knowingly. If the user prefers not to override, alternative is Supabase **private channels** with an authorization RPC — I'll note that as fallback but proceed with RLS since that's what was requested.

**Proof:**
```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy WHERE polrelid = 'realtime.messages'::regclass;
```
Output pasted literally in the final report.

---

## Order of execution in build mode

1. Request `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `PUBLIC_SITE_URL` secrets + confirm real recipient email for the invite test.
2. Migration: `staff_invites` table + `realtime.messages` policies + redact bootstrap migration (single migration, one approval).
3. Rewrite `enrollment.functions.ts` and `staff.functions.ts`, add `/accept-invite` route.
4. Playwright: enrollment E2E → student login. Report row counts + screenshots.
5. Send real invite → user clicks → Playwright completes login → report row + screenshot.
6. Grep + policy-list queries for items 3 and 4.
7. Final report: four literal pass/fail lines with query output, no prose.

## What I need from you before build

- A real email address for the invite test (the earlier `[la tua email]` was a placeholder — I have no address to send to).
- Confirmation that overriding the "never touch realtime schema" rule for item 4 is what you want (vs. private-channel authorization RPC as an alternative).
- Approval to request the three Resend/site secrets.
