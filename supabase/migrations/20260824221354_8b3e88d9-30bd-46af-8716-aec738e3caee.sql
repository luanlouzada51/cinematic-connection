REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_taste() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_person_swipe() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_post_score() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;