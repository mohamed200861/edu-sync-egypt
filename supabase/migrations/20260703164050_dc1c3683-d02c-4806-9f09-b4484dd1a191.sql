
-- ============ payment_methods ============
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write payment_methods" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.payment_methods (code, name_ar, sort_order) VALUES
  ('cash','نقدي',1),
  ('bank_transfer','تحويل بنكي',2),
  ('instapay','إنستاباي',3),
  ('vodafone_cash','فودافون كاش',4),
  ('other','أخرى',5);

-- ============ fee_settings ============
-- scope precedence: student > course > academic_year > default
CREATE TABLE public.fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('default','academic_year','course','student')),
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  monthly_fee numeric(12,2) NOT NULL CHECK (monthly_fee >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fee_settings_default_uniq ON public.fee_settings ((true)) WHERE scope='default';
CREATE UNIQUE INDEX fee_settings_year_uniq ON public.fee_settings (academic_year_id) WHERE scope='academic_year';
CREATE UNIQUE INDEX fee_settings_course_uniq ON public.fee_settings (course_id) WHERE scope='course';
CREATE UNIQUE INDEX fee_settings_student_uniq ON public.fee_settings (student_id) WHERE scope='student';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_settings TO authenticated;
GRANT ALL ON public.fee_settings TO service_role;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read fee_settings" ON public.fee_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Admins write fee_settings" ON public.fee_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_fee_settings_updated BEFORE UPDATE ON public.fee_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default fee 500 EGP so app is usable immediately
INSERT INTO public.fee_settings (scope, monthly_fee, notes) VALUES ('default', 500, 'الرسم الشهري الافتراضي');

-- ============ student_monthly_charges ============
CREATE TABLE public.student_monthly_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount_due numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','partial','pending','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, period_year, period_month)
);
CREATE INDEX idx_charges_student ON public.student_monthly_charges(student_id);
CREATE INDEX idx_charges_period ON public.student_monthly_charges(period_year, period_month);
CREATE INDEX idx_charges_status ON public.student_monthly_charges(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_monthly_charges TO authenticated;
GRANT ALL ON public.student_monthly_charges TO service_role;
ALTER TABLE public.student_monthly_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read charges" ON public.student_monthly_charges FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'secretary')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid())
  );
CREATE POLICY "Admin/Secretary write charges" ON public.student_monthly_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary'));

CREATE TRIGGER trg_charges_updated BEFORE UPDATE ON public.student_monthly_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ receipt_counters ============
CREATE TABLE public.receipt_counters (
  year int PRIMARY KEY,
  last_no int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.receipt_counters TO authenticated;
GRANT ALL ON public.receipt_counters TO service_role;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read receipt_counters" ON public.receipt_counters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary'));

CREATE OR REPLACE FUNCTION public.next_receipt_no(_year int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.receipt_counters(year,last_no) VALUES (_year,1)
    ON CONFLICT (year) DO UPDATE SET last_no = public.receipt_counters.last_no + 1
    RETURNING last_no INTO n;
  RETURN _year::text || '-' || lpad(n::text,6,'0');
END $$;

-- ============ payments ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid REFERENCES public.student_monthly_charges(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  payment_method_id uuid REFERENCES public.payment_methods(id),
  method_code text NOT NULL,
  receipt_no text NOT NULL UNIQUE,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_student ON public.payments(student_id);
CREATE INDEX idx_payments_charge ON public.payments(charge_id);
CREATE INDEX idx_payments_paid_at ON public.payments(paid_at DESC);
CREATE INDEX idx_payments_receipt ON public.payments(receipt_no);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'secretary')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid())
  );
CREATE POLICY "Admin/Secretary insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary'));
CREATE POLICY "Admin/Secretary update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretary'));
CREATE POLICY "Admin delete payments" ON public.payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.get_monthly_fee(_student_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  s RECORD;
  fee numeric;
BEGIN
  SELECT academic_year_id, course_id INTO s FROM public.students WHERE id=_student_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT monthly_fee INTO fee FROM public.fee_settings WHERE scope='student' AND student_id=_student_id LIMIT 1;
  IF fee IS NOT NULL THEN RETURN fee; END IF;

  IF s.course_id IS NOT NULL THEN
    SELECT monthly_fee INTO fee FROM public.fee_settings WHERE scope='course' AND course_id=s.course_id LIMIT 1;
    IF fee IS NOT NULL THEN RETURN fee; END IF;
  END IF;

  IF s.academic_year_id IS NOT NULL THEN
    SELECT monthly_fee INTO fee FROM public.fee_settings WHERE scope='academic_year' AND academic_year_id=s.academic_year_id LIMIT 1;
    IF fee IS NOT NULL THEN RETURN fee; END IF;
  END IF;

  SELECT monthly_fee INTO fee FROM public.fee_settings WHERE scope='default' LIMIT 1;
  RETURN COALESCE(fee,0);
END $$;

CREATE OR REPLACE FUNCTION public.ensure_student_charges(_student_id uuid, _up_to date DEFAULT CURRENT_DATE)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  s RECORD;
  start_date date;
  cur date;
  end_date date;
  fee numeric;
  inserted int := 0;
BEGIN
  SELECT id, academic_year_id, course_id, group_id, enrolled_at, status
    INTO s FROM public.students WHERE id=_student_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  start_date := date_trunc('month', s.enrolled_at)::date;
  end_date := date_trunc('month', _up_to)::date;
  fee := public.get_monthly_fee(_student_id);

  cur := start_date;
  WHILE cur <= end_date LOOP
    INSERT INTO public.student_monthly_charges
      (student_id, academic_year_id, course_id, group_id, period_year, period_month, amount_due)
    VALUES
      (_student_id, s.academic_year_id, s.course_id, s.group_id,
       extract(year FROM cur)::int, extract(month FROM cur)::int, fee)
    ON CONFLICT (student_id, period_year, period_month) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
    cur := cur + interval '1 month';
  END LOOP;
  RETURN inserted;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_charge_status(_charge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  due numeric; disc numeric; paid numeric; net numeric; st text;
BEGIN
  SELECT amount_due, discount, status INTO due, disc, st
    FROM public.student_monthly_charges WHERE id=_charge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF st='cancelled' THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount),0) INTO paid
    FROM public.payments WHERE charge_id=_charge_id AND cancelled_at IS NULL;

  net := GREATEST(due - disc, 0);
  UPDATE public.student_monthly_charges SET amount_paid = paid,
    status = CASE
      WHEN paid <= 0 THEN 'pending'
      WHEN paid >= net THEN 'paid'
      ELSE 'partial'
    END
  WHERE id=_charge_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_payments_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.charge_id IS NOT NULL THEN PERFORM public.recompute_charge_status(OLD.charge_id); END IF;
    RETURN OLD;
  END IF;
  IF NEW.charge_id IS NOT NULL THEN PERFORM public.recompute_charge_status(NEW.charge_id); END IF;
  IF TG_OP='UPDATE' AND OLD.charge_id IS DISTINCT FROM NEW.charge_id AND OLD.charge_id IS NOT NULL THEN
    PERFORM public.recompute_charge_status(OLD.charge_id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payments_after_write
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payments_recompute();
