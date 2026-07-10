-- Add must_change_password flag + bootstrap initial administrator (idempotent).
--
-- SECURITY REDACTION NOTE
-- =======================
-- An earlier version of this file contained a plaintext bootstrap password
-- literal ("mohamed 2009") and manually inserted a row into auth.users via
-- raw crypt(). That literal is a **permanently burned credential** -- treat
-- it as public and never reuse. It has been removed from this file. The
-- live-database password for the seeded admin has been rotated to a random
-- one-time value by a later migration, and the admin must set a real
-- password via the "Forgot password" flow on /admin/login.
--
-- The raw auth.users INSERT is retained *only* for fresh-database
-- initialization, but the password is now a per-migration random value
-- that is never logged or displayed. This is not the recommended path --
-- production deploys should invite the first admin via a manual process.
-- Do not copy this pattern for any other account.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  v_email text := 'ashmawi.2009@gmail.com';
  v_password text := gen_random_uuid()::text || gen_random_uuid()::text;
  v_user_id uuid;
  v_existing uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN;
  END IF;

  SELECT id INTO v_existing FROM auth.users WHERE email = v_email;

  IF v_existing IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name','Initial Administrator'),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now()
    );
  ELSE
    v_user_id := v_existing;
  END IF;

  INSERT INTO public.profiles (id, full_name, must_change_password)
  VALUES (v_user_id, 'Initial Administrator', true)
  ON CONFLICT (id) DO UPDATE SET must_change_password = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
