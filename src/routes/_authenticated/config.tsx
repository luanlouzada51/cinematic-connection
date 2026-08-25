import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, type Lang } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const hasPassword = Boolean(
    (user?.identities ?? []).some((i) => i.provider === "email"),
  );

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

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    if (pwd !== pwd2) {
      toast.error(t("passwordMismatch"));
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) {
        if (error.message.toLowerCase().includes("weak") || error.message.toLowerCase().includes("pwned")) {
          throw new Error(t("passwordTooShort"));
        }
        throw error;
      }
      setPwd("");
      setPwd2("");
      toast.success(t("passwordSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingPwd(false);
    }
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

      <section className="mb-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-xl">{t("passwordSection")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {hasPassword ? user?.email : t("passwordSectionSub")}
        </p>
        <form onSubmit={savePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np">{t("newPassword")}</Label>
            <Input
              id="np"
              type="password"
              required
              minLength={8}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np2">{t("confirmPassword")}</Label>
            <Input
              id="np2"
              type="password"
              required
              minLength={8}
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={savingPwd}>
            {t("savePassword")}
          </Button>
        </form>
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
