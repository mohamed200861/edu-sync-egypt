-- Migration: Create student auth user via RPC
-- This function creates an auth user by directly inserting into auth.users and auth.identities
-- tables, bypassing the blocked .auth.signUp() method on the Lovable platform.
-- Only service_role can execute this function.

CREATE OR REPLACE FUNCTION public.create_student_auth_user(
  p_email text,
  p_password text,
  p_full_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_student_auth_user FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_auth_user TO service_role;
