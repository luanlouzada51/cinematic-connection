import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { genreName, useI18n, type TKey } from "@/lib/i18n";
import { PhotoUploader } from "@/components/PhotoUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { reportSignupConversion } from "@/lib/ads";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Seu perfil — Movie Match" },
      { name: "description", content: "Monte seu perfil e calibre suas recomendações de cinema." },
      { property: "og:title", content: "Seu perfil — Movie Match" },
      {
        property: "og:description",
        content: "Monte seu perfil e calibre suas recomendações de cinema.",
      },
    ],
  }),
  component: Onboarding,
});

type Genre = { slug: string; name_pt: string; name_en: string; name_es: string };

export const GENDERS: { value: string; key: TKey }[] = [
  { value: "male", key: "genderMale" },
  { value: "female", key: "genderFemale" },
  { value: "other", key: "genderOther" },
];

export const INTERESTS: { value: string; key: TKey }[] = [
  { value: "male", key: "interestMen" },
  { value: "female", key: "interestWomen" },
  { value: "both", key: "interestBoth" },
];

function Onboarding() {
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [form, setForm] = useState({
    display_name: "",
    age: "",
    city: "",
    country: "",
    bio: "",
    gender: "",
  });
  const [interested, setInterested] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("genres")
      .select("slug,name_pt,name_en,name_es")
      .order("sort")
      .then(({ data }) => setGenres(data ?? []));
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        age: profile.age ? String(profile.age) : "",
        city: profile.city ?? "",
        country: profile.country ?? "",
        bio: profile.bio ?? "",
        gender: profile.gender ?? "",
      });
      setPicked(profile.favorite_genres ?? []);
      setInterested(profile.interested_in ?? []);
      setPhotos(profile.photos?.length ? profile.photos : profile.avatar_url ? [profile.avatar_url] : []);
    }
  }, [profile]);

  function toggleInterest(v: string) {
    if (v === "both") {
      setInterested(interested.includes("both") ? [] : ["both"]);
      return;
    }
    const base = interested.filter((i) => i !== "both");
    setInterested(base.includes(v) ? base.filter((i) => i !== v) : [...base, v]);
  }

  async function save() {
    if (!user) return;
    if (!form.display_name.trim()) {
      toast.error(t("name"));
      return;
    }
    setBusy(true);
    const detectedCountry =
      form.country.trim() ||
      (typeof window !== "undefined" ? (navigator.language.split("-")[1] ?? "") : "");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim(),
        age: form.age ? Number(form.age) : null,
        city: form.city.trim() || null,
        country: detectedCountry || null,
        bio: form.bio.trim() || null,
        gender: form.gender || null,
        interested_in: interested,
        photos,
        avatar_url: photos[0] ?? null,
        favorite_genres: picked,
        language: lang,
        onboarding_done: true,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!profile?.onboarding_done) reportSignupConversion();
    await refreshProfile();
    void navigate({ to: profile?.onboarding_done ? "/perfil" : "/descobrir" });
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-10">
      <h1 className="text-4xl">{profile?.onboarding_done ? t("editProfile") : t("onboarding")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("onboardingSub")}</p>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
        {user && (
          <div className="space-y-1.5">
            <Label>{t("photos")}</Label>
            <PhotoUploader userId={user.id} photos={photos} onChange={setPhotos} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>{t("name")}</Label>
          <Input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("age")}</Label>
            <Input
              type="number"
              min={18}
              max={99}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("city")}</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("gender")}</Label>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                on={form.gender === g.value}
                onClick={() => setForm({ ...form, gender: g.value })}
              >
                {t(g.key)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("interestedIn")}</Label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((g) => (
              <Chip
                key={g.value}
                on={interested.includes(g.value)}
                onClick={() => toggleInterest(g.value)}
              >
                {t(g.key)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("bio")}</Label>
          <Textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("favoriteGenres")}</Label>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Chip
                key={g.slug}
                on={picked.includes(g.slug)}
                onClick={() =>
                  setPicked(
                    picked.includes(g.slug)
                      ? picked.filter((s) => s !== g.slug)
                      : [...picked, g.slug],
                  )
                }
              >
                {genreName(g, lang)}
              </Chip>
            ))}
          </div>
        </div>

        <Button className="w-full" onClick={() => void save()} disabled={busy}>
          {profile?.onboarding_done ? t("save") : t("finish")}
        </Button>
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary text-secondary-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}
