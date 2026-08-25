import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, type Lang } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/config")({
  head: () => ({
    meta: [
      { title: "Configurações — Movie Match" },
      { name: "description", content: "Idioma, privacidade e usuários bloqueados no Movie Match." },
      { property: "og:title", content: "Configurações — Movie Match" },
      {
        property: "og:description",
        content: "Idioma, privacidade e usuários bloqueados no Movie Match.",
      },
    ],
  }),
  component: SettingsPage,
});

const LANGS: { code: Lang; label: string }[] = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      const ids = (data ?? []).map((b) => b.blocked_id);
      if (!ids.length) return setBlocked([]);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", ids);
      setBlocked((profs ?? []).map((p) => ({ id: p.id, name: p.display_name })));
    })();
  }, [user]);

  async function changeLang(l: Lang) {
    setLang(l);
    if (user) await supabase.from("profiles").update({ language: l }).eq("id", user.id);
  }

  async function unblock(id: string) {
    if (!user) return;
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    setBlocked((b) => b.filter((x) => x.id !== id));
    toast.success(t("unblock"));
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/perfil">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-3xl">{t("settings")}</h1>
      </div>

      <section className="mb-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xl">{t("language")}</h2>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => void changeLang(l.code)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                lang === l.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xl">{t("blockedUsers")}</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noBlocked")}</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                {b.name}
                <Button size="sm" variant="ghost" onClick={() => void unblock(b.id)}>
                  {t("unblock")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
