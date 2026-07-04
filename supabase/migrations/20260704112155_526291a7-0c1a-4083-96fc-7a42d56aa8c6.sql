
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Only one owner ever.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_owner_idx
  ON public.user_roles ((is_owner)) WHERE is_owner;

-- Block any UPDATE/DELETE against an owner row, from any role (including service_role).
CREATE OR REPLACE FUNCTION public.protect_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_owner THEN
      RAISE EXCEPTION 'Owner admin cannot be removed. Clear is_owner via direct SQL first.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.is_owner AND (
       NEW.role IS DISTINCT FROM OLD.role
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.is_owner = false
  ) THEN
    RAISE EXCEPTION 'Owner admin role is protected and cannot be modified via the app.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_owner_role_trg ON public.user_roles;
CREATE TRIGGER protect_owner_role_trg
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_role();

-- Flag the currently seeded admin as owner.
UPDATE public.user_roles
  SET is_owner = true
  WHERE user_id = '4e96b7e2-4dd3-47f2-a925-3248f2cce47b'
    AND role = 'admin';
