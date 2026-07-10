-- Part A: staff_invites
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  role public.app_role NOT NULL CHECK (role IN ('admin','secretary','teacher')),
  specialization text,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_invites_email_idx ON public.staff_invites (lower(email));
GRANT ALL ON public.staff_invites TO service_role;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
-- No policies — only service_role (server fns via supabaseAdmin) can touch it.

-- Part C: redact plaintext admin password from bootstrap
DO $$
DECLARE
  v_email text := 'ashmawi.2009@gmail.com';
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_uid;
    UPDATE public.profiles SET must_change_password = true WHERE id = v_uid;
  END IF;
END $$;