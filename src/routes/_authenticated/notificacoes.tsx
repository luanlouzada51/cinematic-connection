import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Movie Match" },
      { name: "description", content: "Seus matches, mensagens e novidades no Movie Match." },
      { property: "og:title", content: "Notificações — Movie Match" },
      { property: "og:description", content: "Seus matches, mensagens e novidades no Movie Match." },
    ],
  }),
  component: NotificationsPage,
});

type Notif = { id: string; kind: string; body: string; link: string | null; read: boolean };

function NotificationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,kind,body,link,read")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data ?? []) as Notif[]);
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    })();
  }, [user]);

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/perfil">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-3xl">{t("notifications")}</h1>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          {t("noNotifications")}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              {n.link ? (
                <a href={n.link} className="hover:text-primary">
                  {n.body}
                </a>
              ) : (
                n.body
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
