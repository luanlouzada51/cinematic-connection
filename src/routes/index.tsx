import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, Handshake, Radio, Wallet } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useSession } from "@/features/auth/session";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({ component: Landing });

const FEATURES = [
  { icon: CalendarCheck, title: "landing.feature1Title", body: "landing.feature1Body" },
  { icon: Radio, title: "landing.feature2Title", body: "landing.feature2Body" },
  { icon: Handshake, title: "landing.feature3Title", body: "landing.feature3Body" },
  { icon: Wallet, title: "landing.feature4Title", body: "landing.feature4Body" },
] as const;

function Landing() {
  const { t } = useI18n();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/app" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">{t("landing.ctaSignIn")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-5 pb-12 pt-6 text-center md:pt-16">
        <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground">
          {t("landing.heroSubtitle")}
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/auth">{t("landing.ctaStart")}</Link>
        </Button>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-3 px-5 pb-20 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-xl border border-border bg-card p-5 text-left">
            <Icon className="mb-3 size-5 text-primary" />
            <h2 className="text-base font-semibold">{t(title)}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(body)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
