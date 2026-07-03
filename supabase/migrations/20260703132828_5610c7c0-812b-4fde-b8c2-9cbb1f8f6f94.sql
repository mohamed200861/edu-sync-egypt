
-- 1) New student code generator using Crockford base32 (no I, L, O, U, 0, 1)
CREATE OR REPLACE FUNCTION public.next_student_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate TEXT;
  i INT;
  r INT;
  bytes BYTEA;
  attempts INT := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    candidate := 'BIO-';
    bytes := gen_random_bytes(6);
    FOR i IN 0..5 LOOP
      r := get_byte(bytes, i) % length(alphabet);
      candidate := candidate || substr(alphabet, r + 1, 1);
    END LOOP;
    -- Ensure uniqueness against existing student_code values.
    PERFORM 1 FROM public.students WHERE student_code = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Failed to generate unique student code after % attempts', attempts;
    END IF;
  END LOOP;
END;
$$;

-- 2) QR tokens table
CREATE TABLE public.student_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX student_qr_tokens_one_active_per_student
  ON public.student_qr_tokens(student_user_id) WHERE active;
CREATE INDEX student_qr_tokens_student_idx ON public.student_qr_tokens(student_user_id);

GRANT SELECT ON public.student_qr_tokens TO authenticated;
GRANT ALL ON public.student_qr_tokens TO service_role;

ALTER TABLE public.student_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all QR tokens"
  ON public.student_qr_tokens FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Students can read own active QR"
  ON public.student_qr_tokens FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);

-- 3) Attendance settings (singleton)
CREATE TABLE public.attendance_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('auto','manual')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
INSERT INTO public.attendance_settings (id, mode) VALUES (true, 'manual');

GRANT SELECT ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read attendance settings"
  ON public.attendance_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admin can update attendance settings"
  ON public.attendance_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attended_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  attended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent')),
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('auto','manual')),
  device TEXT NOT NULL DEFAULT 'manual' CHECK (device IN ('mobile','webcam','usb','manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX attendance_unique_per_day
  ON public.attendance(student_user_id, attended_on);
CREATE INDEX attendance_attended_on_idx ON public.attendance(attended_on);
CREATE INDEX attendance_student_idx ON public.attendance(student_user_id);

GRANT SELECT, INSERT ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Students can read own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);

CREATE POLICY "Staff can insert attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- No UPDATE or DELETE policies: attendance history is immutable.

-- 5) Enable realtime broadcast (we use broadcast channels, not postgres_changes;
--    no publication changes needed).
