
-- 1. Add must_change_password flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Allow users to update their own must_change_password (via existing self-update policy on profiles).
-- No new policy needed if profiles already has a "users update own" policy.

-- 2. Bootstrap initial admin (idempotent)
DO $$
DECLARE
  v_email text := 'ashmawi.2009@gmail.com';
  v_password text := 'mohamed 2009';
  v_user_id uuid;
  v_existing uuid;
BEGIN
  -- Skip entirely if any admin already exists
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
