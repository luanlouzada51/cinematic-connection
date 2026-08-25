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
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/descobrir" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        if (password.length < 8) throw new Error(t("passwordTooShort"));
        if (password !== password2) throw new Error(t("passwordMismatch"));
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
        ...(provider === "google" ? { extraParams: { prompt: "select_account" } } : {}),
      });
      if (result.error) {
        const raw = (result.error.message ?? "").toLowerCase();
        if (raw.includes("access_denied") || raw.includes("cancel") || raw.includes("closed")) {
          toast.error("Login cancelado. Autorize o acesso para continuar.");
        } else if (raw.includes("popup") || raw.includes("blocked")) {
          toast.error("O popup foi bloqueado. Libere popups para este site e tente de novo.");
        } else if (raw.includes("email")) {
          toast.error("O Google não compartilhou seu e-mail. Autorize o e-mail ou use e-mail e senha.");
        } else if (raw.includes("provider") || raw.includes("unsupported")) {
          toast.error("Login com Google indisponível no momento. Use e-mail e senha.");
        } else {
          toast.error(result.error.message ?? "Não foi possível entrar com Google.");
        }
        return;
      }
      if (result.redirected) return;

      // O helper já grava os tokens. Confirme que a sessão ficou disponível
      // antes de navegar, sem recarregar a página (o reload pode perder a
      // sincronização do armazenamento no preview incorporado).
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast.error("O Google autorizou o acesso, mas a sessão não foi salva. Tente novamente.");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(
        sessionData.session.access_token,
      );
      if (userError || !userData.user) {
        await supabase.auth.signOut({ scope: "local" });
        toast.error("A sessão recebida do Google é inválida. Tente entrar novamente.");
        return;
      }
      if (!userData.user.email) {
        await supabase.auth.signOut({ scope: "local" });
        toast.error("O Google não compartilhou seu e-mail. Autorize o e-mail para continuar.");
        return;
      }

      await navigate({ to: "/descobrir", replace: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      toast.error(
        /cancel|closed|denied/i.test(msg)
          ? "Login cancelado antes de concluir."
          : msg || "Erro no login social",
      );
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
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="password2">{t("confirmPassword")}</Label>
                <Input
                  id="password2"
                  type="password"
                  required
                  minLength={8}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("signupPasswordHint")}</p>
              </div>
            )}
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
