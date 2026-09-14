import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";

export const Route = createFileRoute("/app/")({ component: AppHome });

/** Cada papel tem uma tela inicial diferente. */
function AppHome() {
  const { loading, account, isManager } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !account) return;

    if (!account.onboarding_done) {
      void navigate({ to: "/app/onboarding", replace: true });
      return;
    }

    const destination =
      account.primary_role === "customer"
        ? "/app/visits"
        : account.primary_role === "worker" && !isManager
          ? "/app/today"
          : "/app/schedule";

    void navigate({ to: destination, replace: true });
  }, [loading, account, isManager, navigate]);

  return <LoadingBlock />;
}
