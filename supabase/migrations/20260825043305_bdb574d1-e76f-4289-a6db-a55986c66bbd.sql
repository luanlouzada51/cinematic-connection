DROP FUNCTION IF EXISTS public.claim_owner_admin();

CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = NEW.id AND lower(u.email) = 'luanlouzada51@gmail.com'
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    NEW.is_premium := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_owner_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_owner_admin() FROM anon;
REVOKE ALL ON FUNCTION public.grant_owner_admin() FROM authenticated;

DROP TRIGGER IF EXISTS trg_grant_owner_admin ON public.profiles;
CREATE TRIGGER trg_grant_owner_admin
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();