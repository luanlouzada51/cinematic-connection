import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading, account } = useSession();
  const navigate = useNavigate();

  // Quem ainda não escolheu como vai usar o app não entra nas telas internas.
  useEffect(() => {
    if (!loading && account && !account.onboarding_done) {
      void navigate({ to: "/app/onboarding" });
    }
  }, [loading, account, navigate]);

  return <AppShell>{loading ? <LoadingBlock /> : <Outlet />}</AppShell>;
}
