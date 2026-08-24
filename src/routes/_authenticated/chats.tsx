import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [
      { title: "Seus matches — Movie Match" },
      { name: "description", content: "Converse com quem combina com o seu gosto de cinema." },
      { property: "og:title", content: "Seus matches — Movie Match" },
      {
        property: "og:description",
        content: "Converse com quem combina com o seu gosto de cinema.",
      },
    ],
  }),
  component: Chats,
});

type Row = {
  matchId: string;
  other: { id: string; display_name: string; avatar_url: string | null };
  preview: string;
};

function Chats() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: matches } = await supabase
        .from("matches")
        .select("id,user_a,user_b,created_at")
        .order("created_at", { ascending: false });
      const ids = (matches ?? []).map((m) => (m.user_a === user.id ? m.user_b : m.user_a));
      const { data: people } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const { data: msgs } = await supabase
        .from("messages")
        .select("match_id,body,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const pmap = Object.fromEntries((people ?? []).map((p) => [p.id, p]));
      setRows(
        (matches ?? []).map((m) => {
          const otherId = m.user_a === user.id ? m.user_b : m.user_a;
          return {
            matchId: m.id,
            other: pmap[otherId] ?? { id: otherId, display_name: "?", avatar_url: null },
            preview: (msgs ?? []).find((x) => x.match_id === m.id)?.body ?? "",
          };
        }),
      );
      setLoading(false);
    })();
  }, [user]);

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">{t("chats")}</h1>
      {loading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          {t("noMatches")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.matchId}>
              <Link
                to="/chat/$matchId"
                params={{ matchId: r.matchId }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/50"
              >
                <Avatar className="size-12">
                  <AvatarImage src={r.other.avatar_url ?? undefined} />
                  <AvatarFallback>{r.other.display_name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold">{r.other.display_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{r.preview || "—"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
