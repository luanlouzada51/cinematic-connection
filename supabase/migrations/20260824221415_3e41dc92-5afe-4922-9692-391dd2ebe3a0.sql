REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_taste() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_person_swipe() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_message() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_post_score() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;