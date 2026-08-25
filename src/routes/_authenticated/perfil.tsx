import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Bell, Flame, LogOut, Pencil, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { genreName, useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { Poster } from "@/components/Poster";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Seu perfil — Movie Match" },
      {
        name: "description",
        content: "Seu CineStreak, estatísticas, conquistas e lista de filmes para assistir.",
      },
      { property: "og:title", content: "Seu perfil — Movie Match" },
      {
        property: "og:description",
        content: "Seu CineStreak, estatísticas, conquistas e lista de filmes para assistir.",
      },
    ],
  }),
  component: ProfilePage,
});

const ACHIEVEMENTS: Record<string, { pt: string; en: string; es: string }> = {
  first_rating: { pt: "Primeira nota", en: "First rating", es: "Primera nota" },
  ten_ratings: { pt: "10 títulos avaliados", en: "10 titles rated", es: "10 títulos puntuados" },
  fifty_ratings: { pt: "Cinéfilo (50)", en: "Cinephile (50)", es: "Cinéfilo (50)" },
  streak_7: { pt: "7 dias de CineStreak", en: "7-day CineStreak", es: "7 días de CineStreak" },
  first_match: { pt: "Primeiro match", en: "First match", es: "Primer match" },
};

type WatchItem = { title_id: string; titles: { title: string; poster_url: string | null } | null };

function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [ratingsCount, setRatingsCount] = useState(0);
  const [matches, setMatches] = useState(0);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [earned, setEarned] = useState<string[]>([]);
  const [genres, setGenres] = useState<
    { slug: string; name_pt: string; name_en: string; name_es: string }[]
  >([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ count: rc }, { count: mc }, { data: wl }, { data: ach }, { data: gs }, { count: nc }] =
        await Promise.all([
          supabase.from("ratings").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("matches").select("id", { count: "exact", head: true }),
          supabase
            .from("watchlist")
            .select("title_id,titles(title,poster_url)")
            .eq("user_id", user.id)
            .limit(24),
          supabase.from("achievements").select("code").eq("user_id", user.id),
          supabase.from("genres").select("slug,name_pt,name_en,name_es"),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("read", false),
        ]);
      const ratings = rc ?? 0;
      setRatingsCount(ratings);
      setMatches(mc ?? 0);
      setWatch((wl ?? []) as unknown as WatchItem[]);
      setGenres(gs ?? []);
      setUnread(nc ?? 0);

      const have = new Set((ach ?? []).map((a) => a.code));
      const should: string[] = [];
      if (ratings >= 1) should.push("first_rating");
      if (ratings >= 10) should.push("ten_ratings");
      if (ratings >= 50) should.push("fifty_ratings");
      if ((profile?.streak_count ?? 0) >= 7) should.push("streak_7");
      if ((mc ?? 0) >= 1) should.push("first_match");
      const missing = should.filter((c) => !have.has(c));
      if (missing.length) {
        await supabase
          .from("achievements")
          .insert(missing.map((code) => ({ user_id: user.id, code })));
      }
      setEarned([...have, ...missing]);
    })();
  }, [user, profile?.streak_count]);

  const taste = (profile?.taste_vector ?? {}) as Record<string, number>;
  const topGenre = Object.entries(taste).sort((a, b) => b[1] - a[1])[0]?.[0];
  const gmap = Object.fromEntries(genres.map((g) => [g.slug, g]));

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback>{profile?.display_name?.slice(0, 2) ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl leading-none">{profile?.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {[profile?.age, profile?.city].filter(Boolean).join(" · ")}
          </p>
          {profile?.is_premium && <span className="text-xs text-gold">★ Premium</span>}
        </div>
        <Button size="icon" variant="ghost" asChild aria-label={t("settings")}>
          <Link to="/config">
            <Settings className="size-5" />
          </Link>
        </Button>
      </div>

      {profile?.bio && <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link to="/onboarding">
            <Pencil className="size-4" /> {t("save")}
          </Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link to="/notificacoes">
            <Bell className="size-4" /> {t("notifications")} {unread > 0 ? `(${unread})` : ""}
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void handleSignOut()}>
          <LogOut className="size-4" /> {t("signOut")}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("streak")} value={`${profile?.streak_count ?? 0} ${t("days")}`} icon />
        <Stat label={t("ratedTitles")} value={String(ratingsCount)} />
        <Stat
          label={t("favoriteGenre")}
          value={topGenre ? genreName(gmap[topGenre], lang) : "—"}
        />
        <Stat label={t("hoursWatched")} value={`${Math.round(ratingsCount * 1.9)}h`} />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-2xl">
          <Award className="size-5 text-gold" /> {t("achievements")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(ACHIEVEMENTS).map((code) => {
            const on = earned.includes(code);
            return (
              <span
                key={code}
                className={
                  on
                    ? "rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs text-gold"
                    : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground opacity-50"
                }
              >
                {ACHIEVEMENTS[code]![lang]}
              </span>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-2xl">{t("watchlist")}</h2>
        {watch.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {watch.map((w) => (
              <div key={w.title_id} className="overflow-hidden rounded-xl border border-border">
                <Poster
                  url={w.titles?.poster_url}
                  alt={w.titles?.title ?? ""}
                  className="aspect-2/3 w-full"
                />
                <p className="truncate px-1.5 py-1 text-[11px]">{w.titles?.title}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-4">
        <h2 className="text-2xl text-gold">{t("yearInCinema")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ratingsCount} {t("ratedTitles").toLowerCase()} · {matches} matches ·{" "}
          {profile?.streak_count ?? 0} {t("days")} {t("streak")}
        </p>
      </section>

      <AdSlot />
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1 font-display text-2xl">
        {icon && <Flame className="size-5 text-primary" />}
        {value}
      </p>
    </div>
  );
}
