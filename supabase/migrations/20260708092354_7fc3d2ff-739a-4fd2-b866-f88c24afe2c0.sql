
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_student_charges(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_student_charges(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.next_receipt_no(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_no(int) TO authenticated;

REVOKE ALL ON FUNCTION public.next_student_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_monthly_fee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_charge_status(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_role_separation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_payments_recompute() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_owner_role() FROM PUBLIC, anon, authenticated;
