import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { genreName, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

function Onboarding() {
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [form, setForm] = useState({
    display_name: "",
    age: "",
    city: "",
    bio: "",
    gender: "",
    avatar_url: "",
  });
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
        bio: profile.bio ?? "",
        gender: profile.gender ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
      setPicked(profile.favorite_genres ?? []);
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    if (!form.display_name.trim()) return toast.error(t("name"));
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim(),
        age: form.age ? Number(form.age) : null,
        city: form.city.trim() || null,
        bio: form.bio.trim() || null,
        gender: form.gender || null,
        avatar_url: form.avatar_url.trim() || null,
        favorite_genres: picked,
        language: lang,
        onboarding_done: true,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    void navigate({ to: "/descobrir" });
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-10">
      <h1 className="text-4xl">{t("onboarding")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("onboardingSub")}</p>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
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
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("gender")}</Label>
          <Input
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("photoUrl")}</Label>
          <Input
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            placeholder="https://"
          />
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
            {genres.map((g) => {
              const on = picked.includes(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() =>
                    setPicked(on ? picked.filter((s) => s !== g.slug) : [...picked, g.slug])
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-secondary-foreground hover:border-primary/50",
                  )}
                >
                  {genreName(g, lang)}
                </button>
              );
            })}
          </div>
        </div>

        <Button className="w-full" onClick={() => void save()} disabled={busy}>
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
