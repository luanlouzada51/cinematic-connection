import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({
    meta: [
      { title: "Movie Match Premium" },
      {
        name: "description",
        content: "Sem anúncios, filtros avançados, super likes, boost e desfazer swipe.",
      },
      { property: "og:title", content: "Movie Match Premium" },
      {
        property: "og:description",
        content: "Sem anúncios, filtros avançados, super likes, boost e desfazer swipe.",
      },
    ],
  }),
  component: Premium,
});

function Premium() {
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();

  const perks = {
    pt: [
      "Navegação sem anúncios",
      "Filtros avançados de pessoas (idade, cidade)",
      "Super likes ilimitados",
      "Desfazer o último swipe",
      "Boost de perfil na fila de descoberta",
    ],
    en: [
      "Ad-free browsing",
      "Advanced people filters (age, city)",
      "Unlimited super likes",
      "Undo your last swipe",
      "Profile boost in the discovery queue",
    ],
    es: [
      "Navegación sin anuncios",
      "Filtros avanzados de personas (edad, ciudad)",
      "Super likes ilimitados",
      "Deshacer el último swipe",
      "Boost de perfil en la cola de descubrimiento",
    ],
  }[lang];

  async function toggle(next: boolean) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ is_premium: next }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success(next ? t("premiumActive") : t("cancelPremium"));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-3xl border border-gold/40 bg-gold/5 p-6 text-center">
        <Crown className="mx-auto size-10 text-gold" />
        <h1 className="mt-3 text-4xl text-gold">Premium</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("premiumPerks")}</p>

        <ul className="mt-5 space-y-2 text-left">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-gold" />
              {p}
            </li>
          ))}
        </ul>

        <p className="mt-6 font-display text-4xl">
          R$ 19,90<span className="text-base text-muted-foreground">/mês</span>
        </p>

        {profile?.is_premium ? (
          <Button className="mt-4 w-full" variant="secondary" onClick={() => void toggle(false)}>
            {t("cancelPremium")}
          </Button>
        ) : (
          <Button className="mt-4 w-full shadow-cine" onClick={() => void toggle(true)}>
            {t("goPremium")}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
