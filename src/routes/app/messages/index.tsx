import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useThreadDirectory, useThreads } from "@/features/messaging/api";
import { formatTimestamp } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/messages/")({ component: MessagesPage });

function MessagesPage() {
  const { t, locale } = useI18n();
  const { company } = useSession();
  const threads = useThreads();
  const directory = useThreadDirectory(threads.data ?? []);

  if (threads.isLoading) return <LoadingBlock />;
  if ((threads.data?.length ?? 0) === 0) {
    return <EmptyState icon={MessageCircle} title={t("messages.empty")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("messages.title")}</h1>

      <ul className="flex flex-col gap-2">
        {threads.data?.map((thread) => {
          // Quem trabalha na empresa vê o outro lado; quem é de fora vê a empresa.
          const insideCompany = company?.id === thread.company_id;
          const title = insideCompany
            ? thread.kind === "customer"
              ? (directory.data?.customerNames.get(thread.customer_id ?? "") ?? "—")
              : (directory.data?.workerNames.get(thread.worker_id ?? "") ?? "—")
            : (directory.data?.companyNames.get(thread.company_id) ?? "—");

          return (
            <li key={thread.id}>
              <Link
                to="/app/messages/$threadId"
                params={{ threadId: thread.id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40"
              >
                <Avatar name={title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {thread.kind === "gig" ? t("messages.aboutGig") : t("nav.clients")}
                  </p>
                </div>
                {thread.last_message_at ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTimestamp(thread.last_message_at, locale)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
