import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel do administrador — Movie Match" },
      {
        name: "description",
        content: "Métricas de usuários, catálogo e denúncias do Movie Match.",
      },
      { property: "og:title", content: "Painel do administrador — Movie Match" },
      {
        property: "og:description",
        content: "Métricas de usuários, catálogo e denúncias do Movie Match.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Report = { id: string; reason: string; context: string | null; created_at: string };
type UserRow = { id: string; display_name: string; city: string | null; is_premium: boolean };

function AdminPage() {
  const { t } = useI18n();
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState(0);
  const [titles, setTitles] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [latest, setLatest] = useState<UserRow[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const [{ count: uc }, { count: tc }, { data: rs }, { data: us }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("titles").select("id", { count: "exact", head: true }),
        supabase
          .from("reports")
          .select("id,reason,context,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("id,display_name,city,is_premium")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setUsers(uc ?? 0);
      setTitles(tc ?? 0);
      setReports((rs ?? []) as Report[]);
      setLatest((us ?? []) as UserRow[]);
    })();
  }, [isAdmin]);

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <h1 className="text-3xl">{t("adminPanel")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">403</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-4 flex items-center gap-2 text-3xl">
        <Shield className="size-6 text-gold" /> {t("adminPanel")}
      </h1>

      <div className="grid grid-cols-3 gap-3">
        <Card label={t("totalUsers")} value={users} />
        <Card label={t("totalTitles")} value={titles} />
        <Card label={t("totalReports")} value={reports.length} />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-2xl">{t("latestUsers")}</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {latest.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="truncate">{u.display_name}</span>
              <span className="text-xs text-muted-foreground">
                {u.city ?? "—"} {u.is_premium ? "· ★" : ""}
              </span>
            </li>
          ))}
          {latest.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">{t("empty")}</li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-2xl">{t("latestReports")}</h2>
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
              <p className="font-semibold">{r.reason}</p>
              {r.context && <p className="text-xs text-muted-foreground">{r.context}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </p>
            </li>
          ))}
          {reports.length === 0 && (
            <li className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              {t("empty")}
            </li>
          )}
        </ul>
      </section>
    </AppShell>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}
