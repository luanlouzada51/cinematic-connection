import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { Heart, MapPin, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { botReactToSwipe } from "@/lib/bots.functions";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { PhotoImg } from "@/components/PhotoImg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas — Movie Match" },
      {
        name: "description",
        content: "Conheça pessoas com gosto de cinema parecido com o seu e dê match.",
      },
      { property: "og:title", content: "Pessoas — Movie Match" },
      {
        property: "og:description",
        content: "Conheça pessoas com gosto de cinema parecido com o seu e dê match.",
      },
    ],
  }),
  component: People,
});

type Person = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  gender: string | null;
  interested_in: string[];
  photos: string[];
  favorite_genres: string[];
  taste_vector: Record<string, number>;
  is_bot: boolean;
  affinity: number;
};

function cosine(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  let dot = 0;
  let na = 0;
  let nb = 0;
  keys.forEach((k) => {
    const va = a?.[k] ?? 0;
    const vb = b?.[k] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  });
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function People() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("99");
  const [sameCity, setSameCity] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: people }, { data: swipes }, { data: blocked }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,display_name,avatar_url,age,city,bio,gender,interested_in,photos,favorite_genres,taste_vector,is_bot",
        )
        .neq("id", user.id)
        .eq("onboarding_done", true)
        .eq("allow_matches", true)
        .limit(300),
      supabase.from("person_swipes").select("target_id").eq("swiper_id", user.id),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
    ]);
    const skip = new Set([
      ...(swipes ?? []).map((s) => s.target_id),
      ...(blocked ?? []).map((b) => b.blocked_id),
    ]);
    const mine = (profile?.taste_vector ?? {}) as Record<string, number>;
    const list = (people ?? [])
      .filter((p) => !skip.has(p.id))
      .filter((p) => {
        const mineWants = profile?.interested_in ?? [];
        if (mineWants.length && !mineWants.includes("both") && p.gender) {
          if (!mineWants.includes(p.gender)) return false;
        }
        const theirWants = (p.interested_in ?? []) as string[];
        if (theirWants.length && !theirWants.includes("both") && profile?.gender) {
          if (!theirWants.includes(profile.gender)) return false;
        }
        if (profile?.is_premium) {
          if (p.age && (p.age < Number(minAge) || p.age > Number(maxAge))) return false;
          if (sameCity && profile.city && p.city !== profile.city) return false;
        }
        return true;
      })
      .map((p) => ({
        ...p,
        photos: (p.photos ?? []) as string[],
        interested_in: (p.interested_in ?? []) as string[],
        taste_vector: (p.taste_vector ?? {}) as Record<string, number>,
        affinity: cosine(mine, (p.taste_vector ?? {}) as Record<string, number>),
      }))
      .sort((a, b) => b.affinity - a.affinity) as Person[];
    setDeck(list);
    setLoading(false);
  }, [user, profile, minAge, maxAge, sameCity]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, minAge, maxAge, sameCity]);

  const current = deck[0];

  const decide = useCallback(
    async (liked: boolean, superLike = false) => {
      if (!user || !current) return;
      const target = current;
      setDeck((d) => d.slice(1));
      const { error } = await supabase.from("person_swipes").insert({
        swiper_id: user.id,
        target_id: target.id,
        liked,
        super_like: superLike,
      });
      if (error) { toast.error(error.message); return; }
      if (liked) {
        if (target.is_bot) {
          try {
            const res = await botReactToSwipe({ data: { targetId: target.id } });
            if (res.matched && res.matchId) {
              const matchId = res.matchId;
              toast.success(`${t("itsAMatch")} ${target.display_name}`, {
                action: {
                  label: t("chats"),
                  onClick: () => void navigate({ to: "/chat/$matchId", params: { matchId } }),
                },
              });
              return;
            }
          } catch {
            /* segue o fluxo normal */
          }
        }
        const { data: match } = await supabase
          .from("matches")
          .select("id")
          .or(`and(user_a.eq.${user.id},user_b.eq.${target.id}),and(user_a.eq.${target.id},user_b.eq.${user.id})`)
          .maybeSingle();
        if (match) {
          toast.success(`${t("itsAMatch")} ${target.display_name}`, {
            action: {
              label: t("chats"),
              onClick: () => void navigate({ to: "/chat/$matchId", params: { matchId: match.id } }),
            },
          });
        }
      }
    },
    [user, current, t, navigate],
  );

  return (
    <AppShell>
      {profile && !profile.allow_matches && (
        <p className="mb-3 rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">
          {t("matchesDisabled")}
        </p>
      )}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-3xl">{t("people")}</h1>
        <Button size="sm" variant="ghost" onClick={() => setShowFilters((v) => !v)}>
          {t("filters")}
        </Button>
      </div>

      {showFilters && (
        <div className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          {!profile?.is_premium && (
            <p className="text-xs text-gold">{t("premiumPerks")}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("ageRange")}</Label>
              <Input
                type="number"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                disabled={!profile?.is_premium}
              />
            </div>
            <div className="space-y-1.5">
              <Label>&nbsp;</Label>
              <Input
                type="number"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                disabled={!profile?.is_premium}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("sameCity")}</Label>
            <Switch
              checked={sameCity}
              onCheckedChange={setSameCity}
              disabled={!profile?.is_premium}
            />
          </div>
        </div>
      )}

      <div className="relative mx-auto h-[60vh] max-h-[540px] w-full max-w-sm">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-border bg-card text-muted-foreground">
            {t("loading")}
          </div>
        ) : !current ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-border bg-card p-6 text-center text-muted-foreground">
            {t("noPeople")}
          </div>
        ) : (
          <PersonCard key={current.id} person={current} onDecide={(v) => void decide(v)} />
        )}
      </div>

      <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-4">
        <Button
          size="icon"
          variant="secondary"
          className="size-14 rounded-full"
          onClick={() => void decide(false)}
          disabled={!current}
          aria-label={t("notInterested")}
        >
          <X className="size-6 text-destructive" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="size-11 rounded-full"
          aria-label={t("superLike")}
          disabled={!current}
          onClick={() => {
            if (!profile?.is_premium) { toast.error(t("premiumPerks")); return; }
            void decide(true, true);
          }}
        >
          <Sparkles className="size-4 text-gold" />
        </Button>
        <Button
          size="icon"
          className="size-14 rounded-full shadow-cine"
          onClick={() => void decide(true)}
          disabled={!current}
          aria-label={t("interested")}
        >
          <Heart className="size-6" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-11 rounded-full"
          onClick={() => void load()}
          aria-label={t("resetDeck")}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <AdSlot index={1} />
    </AppShell>
  );
}

function PersonCard({ person, onDecide }: { person: Person; onDecide: (liked: boolean) => void }) {
  const { t } = useI18n();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);

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
      <PhotoImg
        path={person.photos?.[0] ?? person.avatar_url}
        alt={person.display_name}
        className="h-full w-full"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <span className="mb-2 inline-block rounded-full bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground">
          {Math.round(person.affinity * 100)}% {t("similarTaste")}
        </span>
        <h2 className="text-3xl leading-tight">
          {person.display_name}
          {person.age ? <span className="text-muted-foreground"> {person.age}</span> : null}
        </h2>
        {person.city && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {person.city}
          </p>
        )}
        {person.bio && <p className="mt-2 line-clamp-3 text-sm text-foreground/90">{person.bio}</p>}
      </div>
    </motion.div>
  );
}
