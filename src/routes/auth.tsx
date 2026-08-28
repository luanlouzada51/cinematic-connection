import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useSession } from "@/features/auth/session";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({ ssr: false, component: AuthPage });

type Mode = "signIn" | "signUp";

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading } = useSession();

  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/app" });
  }, [loading, user, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      if (mode === "signUp") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        toast.success(t("auth.signUpSuccess"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google");
    if (result.error) {
      toast.error(result.error.message);
      setBusy(false);
      return;
    }
    if (!result.redirected) await navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          {t("app.name")}
        </Link>
        <LocaleToggle />
      </header>

      <main className="mx-auto w-full max-w-md px-5 pb-16">
        <h1 className="text-2xl font-semibold">
          {mode === "signIn" ? t("auth.signIn") : t("auth.signUp")}
        </h1>

        <Button variant="outline" block className="mt-6" onClick={handleGoogle} disabled={busy}>
          {t("auth.continueGoogle")}
        </Button>

        <p className="my-5 text-center text-xs uppercase tracking-wide text-muted-foreground">
          {t("auth.orEmail")}
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === "signUp" ? (
            <Field label={t("auth.name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          ) : null}

          <Field label={t("auth.email")}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
            <Input
              type="password"
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <Button type="submit" block disabled={busy}>
            {busy ? t("common.saving") : mode === "signIn" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>

        <button
          type="button"
          className="mt-6 w-full text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
        >
          {mode === "signIn" ? t("auth.noAccount") : t("auth.haveAccount")}
        </button>
      </main>
    </div>
  );
}
