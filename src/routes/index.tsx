import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clapperboard, Heart, MessageCircle, Users, Star, Flame } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Movie Match — cinema, gosto e gente que combina" },
      {
        name: "description",
        content:
          "Deslize por filmes e séries, descubra seu perfil de gosto e conheça pessoas que amam o mesmo cinema que você.",
      },
      { property: "og:title", content: "Movie Match — cinema, gosto e gente que combina" },
      {
        property: "og:description",
        content:
          "Deslize por filmes e séries, descubra seu perfil de gosto e conheça pessoas que amam o mesmo cinema que você.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/descobrir" });
  }, [loading, user, navigate]);

  const features = [
    { icon: Clapperboard, key: "discover" as const },
    { icon: Users, key: "communities" as const },
    { icon: Heart, key: "people" as const },
    { icon: MessageCircle, key: "chats" as const },
  ];

  return (
    <div className="min-h-screen bg-reel">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <Flame className="size-6 text-primary" />
          <span className="font-display text-3xl leading-none text-gradient-cine">Movie Match</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">{t("signIn")}</Link>
        </Button>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8 text-center md:pt-20">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          <Star className="size-3.5 fill-gold" /> CineStreak, comunidades e watch parties
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl leading-[0.95] md:text-7xl">{t("tagline")}</h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          {t("heroSub")}
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="shadow-cine">
            <Link to="/auth">{t("start")}</Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4">
          {features.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-card/70 p-5 text-left backdrop-blur"
            >
              <Icon className="mb-3 size-6 text-primary" />
              <p className="font-display text-xl">{t(key)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
