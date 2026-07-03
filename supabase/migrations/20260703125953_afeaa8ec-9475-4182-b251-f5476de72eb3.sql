-- Phase 2: enforce hard separation between staff and student accounts at the DB level.
-- A single user can never hold both a student role and any staff role.
CREATE OR REPLACE FUNCTION public.enforce_role_separation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role IN ('admin', 'secretary', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Security: cannot assign student role to a staff user (user_id=%).', NEW.user_id;
  END IF;
  IF NEW.role IN ('admin', 'secretary', 'teacher') AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'Security: cannot assign staff role (%) to a student user (user_id=%).', NEW.role, NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_enforce_separation ON public.user_roles;
CREATE TRIGGER user_roles_enforce_separation
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_separation();

-- Helper the app uses to classify a user as staff (admin/secretary/teacher).
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','secretary','teacher')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon;