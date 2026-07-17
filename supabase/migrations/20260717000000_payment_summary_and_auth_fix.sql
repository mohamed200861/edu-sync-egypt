-- ============================================================
-- Migration: payment summary RPC + hardened auth user creation
-- ============================================================

-- 1. Harden create_student_auth_user: add ON CONFLICT guard so
--    a duplicate email doesn't crash the whole enrollment flow.
--    The function is SECURITY DEFINER / service_role only.
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
  v_user_id uuid;
BEGIN
  -- If an auth user already exists with this email, return their id.
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    is_sso_user,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),                -- email pre-confirmed (students don't confirm via email)
    false,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    '',
    '',
    '',
    '',
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,            -- Supabase email provider: identity.id = user.id
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub',   v_user_id::text,
      'email', p_email,
      'email_verified', true,
      'provider_id', v_user_id::text
    ),
    'email',
    now(),
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_student_auth_user FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_student_auth_user TO service_role;


-- 2. get_student_payment_summary
--    Returns a single JSONB snapshot of a student's payment state:
--    - current month charge status
--    - number of overdue (non-paid, non-cancelled) past months
--    Called from resolveStudentQrToken via .rpc() (service_role or authenticated staff).
CREATE OR REPLACE FUNCTION public.get_student_payment_summary(_student_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id       uuid;
  v_cur_year         int  := extract(year  FROM now())::int;
  v_cur_month        int  := extract(month FROM now())::int;
  v_cur_charge       RECORD;
  v_overdue_count    int;
  v_result           jsonb;
BEGIN
  -- Resolve students.id from auth user id
  SELECT id INTO v_student_id FROM public.students WHERE user_id = _student_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'current_month_status', 'no_charge',
      'current_month_year',   v_cur_year,
      'current_month_month',  v_cur_month,
      'amount_due',           0,
      'amount_paid',          0,
      'overdue_months',       0
    );
  END IF;

  -- Current month charge
  SELECT status, amount_due, amount_paid
    INTO v_cur_charge
    FROM public.student_monthly_charges
   WHERE student_id   = v_student_id
     AND period_year  = v_cur_year
     AND period_month = v_cur_month;

  -- Overdue: past months (before current) that are still pending or partial
  SELECT COUNT(*)::int INTO v_overdue_count
    FROM public.student_monthly_charges
   WHERE student_id = v_student_id
     AND (period_year < v_cur_year
          OR (period_year = v_cur_year AND period_month < v_cur_month))
     AND status IN ('pending', 'partial');

  IF NOT FOUND OR v_cur_charge IS NULL THEN
    v_result := jsonb_build_object(
      'current_month_status', 'no_charge',
      'current_month_year',   v_cur_year,
      'current_month_month',  v_cur_month,
      'amount_due',           0,
      'amount_paid',          0,
      'overdue_months',       COALESCE(v_overdue_count, 0)
    );
  ELSE
    v_result := jsonb_build_object(
      'current_month_status', v_cur_charge.status,
      'current_month_year',   v_cur_year,
      'current_month_month',  v_cur_month,
      'amount_due',           v_cur_charge.amount_due,
      'amount_paid',          v_cur_charge.amount_paid,
      'overdue_months',       COALESCE(v_overdue_count, 0)
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_student_payment_summary FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_student_payment_summary TO authenticated, service_role;
