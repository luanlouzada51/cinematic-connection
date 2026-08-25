import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { Bookmark, Check, Info, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { genreName, useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { Poster } from "@/components/Poster";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/descobrir")({
  head: () => ({
    meta: [
      { title: "Descobrir filmes — Movie Match" },
      {
        name: "description",
        content: "Deslize por filmes e séries e monte seu perfil de gosto no Movie Match.",
      },
      { property: "og:title", content: "Descobrir filmes — Movie Match" },
      {
        property: "og:description",
        content: "Deslize por filmes e séries e monte seu perfil de gosto no Movie Match.",
      },
    ],
  }),
  component: Discover,
});

type Title = {
  id: string;
  title: string;
  year: number | null;
  kind: string;
  overview: string | null;
  poster_url: string | null;
  cast_list: string | null;
  genre_slugs: string[];
};
type Genre = { slug: string; name_pt: string; name_en: string; name_es: string };
type Score = { title_id: string | null; avg_stars: number | null; ratings_count: number | null };

function Discover() {
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const [deck, setDeck] = useState<Title[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Title | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [last, setLast] = useState<Title | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: titles }, { data: swipes }, { data: gs }, { data: sc }] = await Promise.all([
      supabase.from("titles").select("*").limit(500),
      supabase.from("content_swipes").select("title_id,interested").eq("user_id", user.id),
      supabase.from("genres").select("slug,name_pt,name_en,name_es").order("sort"),
      supabase.from("title_scores").select("*"),
    ]);
    const seen = new Set((swipes ?? []).map((s) => s.title_id));
    const taste = (profile?.taste_vector ?? {}) as Record<string, number>;
    const fav = profile?.favorite_genres ?? [];
    const country = (profile?.country ?? "").toUpperCase();
    // Reforça gêneros dos títulos que a pessoa já marcou como interessantes.
    const likedIds = new Set(
      (swipes ?? []).filter((s) => s.interested).map((s) => s.title_id),
    );
    const likedGenres: Record<string, number> = {};
    (titles ?? [])
      .filter((x) => likedIds.has(x.id))
      .forEach((x) => x.genre_slugs.forEach((g) => (likedGenres[g] = (likedGenres[g] ?? 0) + 0.8)));
    const ranked = (titles ?? [])
      .filter((x) => !seen.has(x.id))
      .map((x) => {
        const affinity = x.genre_slugs.reduce(
          (acc, g) =>
            acc + (taste[g] ?? 0) + (fav.includes(g) ? 1.5 : 0) + (likedGenres[g] ?? 0),
          0,
        );
        const cultural =
          country && (x as { country?: string | null }).country?.toUpperCase() === country
            ? 2.5
            : 0;
        return { x, k: affinity + cultural + Math.random() * 1.2 };
      })
      .sort((a, b) => b.k - a.k)
      .map((r) => r.x as Title);
    setDeck(ranked);
    setGenres(gs ?? []);
    setScores(Object.fromEntries((sc ?? []).map((s) => [s.title_id ?? "", s as Score])));
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const current = deck[0];
  const next = deck[1];

  const decide = useCallback(
    async (interested: boolean) => {
      if (!user || !current) return;
      const card = current;
      setLast(card);
      setDeck((d) => d.slice(1));
      await supabase
        .from("content_swipes")
        .upsert({ user_id: user.id, title_id: card.id, interested });
      if (interested) {
        await supabase
          .from("watchlist")
          .upsert({ user_id: user.id, title_id: card.id }, { onConflict: "user_id,title_id" });
        toast.success(`${card.title} → ${t("watchlist")}`);
      }
    },
    [user, current, t],
  );

  async function undo() {
    if (!user || !last) return;
    if (!profile?.is_premium) {
      toast.error(t("premiumPerks"));
      return;
    }
    await supabase
      .from("content_swipes")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", last.id);
    setDeck((d) => [last, ...d]);
    setLast(null);
  }

  async function openDetail(title: Title) {
    setDetail(title);
    if (!user) return;
    const { data } = await supabase
      .from("ratings")
      .select("stars")
      .eq("user_id", user.id)
      .eq("title_id", title.id)
      .maybeSingle();
    setMyRating(data?.stars ?? 0);
  }

  async function rate(stars: number) {
    if (!user || !detail) return;
    setMyRating(stars);
    const { error } = await supabase
      .from("ratings")
      .upsert({ user_id: user.id, title_id: detail.id, stars }, { onConflict: "user_id,title_id" });
    if (error) { toast.error(error.message); return; }
    toast.success(`${t("yourRating")}: ${stars}★`);
    await refreshProfile();
  }

  async function resetDeck() {
    if (!user) return;
    await supabase.from("content_swipes").delete().eq("user_id", user.id);
    await load();
  }

  const gmap = useMemo(() => Object.fromEntries(genres.map((g) => [g.slug, g])), [genres]);

  return (
    <AppShell>
      <h1 className="mb-1 text-3xl">{t("discover")}</h1>
      <p className="mb-4 text-xs text-muted-foreground">{t("swipeHint")}</p>

      <div className="relative mx-auto h-[62vh] max-h-[560px] w-full max-w-sm">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-border bg-card text-muted-foreground">
            {t("loading")}
          </div>
        ) : !current ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">{t("endOfDeck")}</p>
            <Button variant="secondary" onClick={() => void resetDeck()}>
              <RotateCcw className="size-4" /> {t("resetDeck")}
            </Button>
          </div>
        ) : (
          <>
            {next && (
              <div className="absolute inset-0 scale-95 rounded-3xl border border-border bg-card opacity-60" />
            )}
            <SwipeCard
              key={current.id}
              title={current}
              genreLabel={(s: string) => genreName(gmap[s], lang)}
              score={scores[current.id]}
              onDecide={(v) => void decide(v)}
              onOpen={() => void openDetail(current)}
            />
          </>
        )}
      </div>

      <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-4">
        <Button
          size="icon"
          variant="secondary"
          className="size-14 rounded-full"
          aria-label={t("notInterested")}
          onClick={() => void decide(false)}
          disabled={!current}
        >
          <X className="size-6 text-destructive" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="size-11 rounded-full"
          aria-label={t("undo")}
          onClick={() => void undo()}
          disabled={!last}
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          size="icon"
          className="size-14 rounded-full shadow-cine"
          aria-label={t("interested")}
          onClick={() => void decide(true)}
          disabled={!current}
        >
          <Check className="size-6" />
        </Button>
      </div>

      <AdSlot />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl">
              {detail?.title} {detail?.year ? `(${detail.year})` : ""}
            </DialogTitle>
            <DialogDescription>
              {detail?.genre_slugs.map((s) => genreName(gmap[s], lang)).join(" · ")}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <Poster
                url={detail.poster_url}
                alt={detail.title}
                className="max-h-64 w-full rounded-xl object-contain"
              />
              <p className="text-sm text-muted-foreground">{detail.overview}</p>
              {detail.cast_list && (
                <p className="text-sm">
                  <span className="text-muted-foreground">{t("cast")}: </span>
                  {detail.cast_list}
                </p>
              )}
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">{t("internalScore")}</p>
                <p className="font-display text-2xl text-gold">
                  {scores[detail.id]?.avg_stars
                    ? `${Number(scores[detail.id]?.avg_stars).toFixed(1)} ★ (${scores[detail.id]?.ratings_count})`
                    : t("noRatings")}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">{t("yourRating")}</p>
                <StarRating value={myRating} onChange={(v) => void rate(v)} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SwipeCard({
  title,
  genreLabel,
  score,
  onDecide,
  onOpen,
}: {
  title: Title;
  genreLabel: (s: string) => string;
  score?: Score | undefined;
  onDecide: (interested: boolean) => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const yes = useTransform(x, [40, 160], [0, 1]);
  const no = useTransform(x, [-160, -40], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 cursor-grab overflow-hidden rounded-3xl border border-border bg-card shadow-cine active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110) {
          void animate(x, 500, { duration: 0.2 });
          onDecide(true);
        } else if (info.offset.x < -110) {
          void animate(x, -500, { duration: 0.2 });
          onDecide(false);
        } else {
          void animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
        }
      }}
    >
      <Poster url={title.poster_url} alt={title.title} className="h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <motion.div
        style={{ opacity: yes }}
        className="absolute left-5 top-5 rotate-[-12deg] rounded-lg border-2 border-success px-3 py-1 font-display text-2xl text-success"
      >
        ✓
      </motion.div>
      <motion.div
        style={{ opacity: no }}
        className="absolute right-5 top-5 rotate-[12deg] rounded-lg border-2 border-destructive px-3 py-1 font-display text-2xl text-destructive"
      >
        ✕
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {title.genre_slugs.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-full bg-secondary/80 px-2 py-0.5 text-[11px] text-secondary-foreground"
            >
              {genreLabel(s)}
            </span>
          ))}
        </div>
        <h2 className="text-3xl leading-tight">
          {title.title} {title.year ? <span className="text-muted-foreground">{title.year}</span> : null}
        </h2>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">{title.kind}</span>
          {score?.avg_stars ? (
            <span className="text-gold">{Number(score.avg_stars).toFixed(1)} ★</span>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={onOpen}>
            <Info className="size-4" /> Detalhes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide(true)}>
            <Bookmark className="size-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
