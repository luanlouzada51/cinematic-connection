import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Movie Match" },
      { name: "description", content: "Acesse sua conta Movie Match e continue descobrindo filmes." },
      { property: "og:title", content: "Entrar — Movie Match" },
      {
        property: "og:description",
        content: "Acesse sua conta Movie Match e continue descobrindo filmes.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/descobrir" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/descobrir` },
        });
        if (error) {
          if (error.message.toLowerCase().includes("already registered")) {
            throw new Error(
              "Esse e-mail já tem conta. Entre com a senha ou use 'Continuar com Google'.",
            );
          }
          if (error.message.toLowerCase().includes("weak")) {
            throw new Error("Senha muito fraca ou vazada. Escolha uma senha mais forte.");
          }
          throw error;
        }
        toast.success("Conta criada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            throw new Error(
              "E-mail ou senha incorretos. Se você criou a conta com Google, use 'Continuar com Google'.",
            );
          }
          throw error;
        }
      }
      void navigate({ to: "/descobrir" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "apple") {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
        extraParams: provider === "google" ? { prompt: "select_account" } : undefined,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Erro no login social");
        return;
      }
      if (result.redirected) return;
      // Confirma o usuário com o servidor antes de entrar na área protegida.
      // O reload evita que o guard leia um estado anterior durante o retorno do popup.
      for (let i = 0; i < 12; i++) {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) {
          window.location.replace("/descobrir");
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      toast.error("Não foi possível concluir o login. Tente novamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro no login social");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-reel px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Flame className="size-6 text-primary" />
          <span className="font-display text-3xl leading-none text-gradient-cine">Movie Match</span>
        </Link>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-cine">
          <h1 className="mb-1 text-3xl">{mode === "in" ? t("signIn") : t("signUp")}</h1>
          <p className="mb-5 text-sm text-muted-foreground">{t("tagline")}</p>

          <div className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => void social("google")}>
              {t("continueGoogle")}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => void social("apple")}>
              {t("continueApple")}
            </Button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? t("signIn") : t("signUp")}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "in" ? t("noAccount") : t("haveAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
