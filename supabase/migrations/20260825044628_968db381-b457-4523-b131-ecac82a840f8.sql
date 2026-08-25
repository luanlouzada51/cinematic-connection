
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_matched_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE (m.user_a = auth.uid() AND m.user_b = _other)
       OR (m.user_b = auth.uid() AND m.user_a = _other)
  )
$$;
REVOKE ALL ON FUNCTION public.is_matched_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_matched_with(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles readable by signed in" ON public.profiles;
CREATE POLICY "profiles readable when discoverable or related"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.is_matched_with(id)
  OR allow_matches = true
);

DROP POLICY IF EXISTS "Authenticated can view profile photos" ON storage.objects;
CREATE POLICY "Photos viewable by owner or discoverable profiles"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_matched_with(((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = ((storage.foldername(name))[1])::uuid
        AND p.allow_matches = true
    )
  )
);
