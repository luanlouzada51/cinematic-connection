
CREATE OR REPLACE FUNCTION public.is_matched_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE (m.user_a = auth.uid() AND m.user_b = _other)
       OR (m.user_b = auth.uid() AND m.user_a = _other)
  )
$$;
