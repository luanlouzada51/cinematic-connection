import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";

const houseAds = [
  {
    pt: "Assine Premium e navegue sem anúncios.",
    en: "Go Premium and browse ad-free.",
    es: "Hazte Premium y navega sin anuncios.",
  },
  {
    pt: "Filtros avançados, super likes e boost no Premium.",
    en: "Advanced filters, super likes and boost with Premium.",
    es: "Filtros avanzados, super likes y boost con Premium.",
  },
];

/** Banner ad slot. Automatically hidden for premium members. */
export function AdSlot({ index = 0 }: { index?: number }) {
  const { profile } = useAuth();
  const { lang, t } = useI18n();
  if (profile?.is_premium) return null;
  const ad = houseAds[index % houseAds.length]!;

  return (
    <Link
      to="/premium"
      className="my-3 flex items-center gap-3 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-4 py-3"
    >
      <Crown className="size-5 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("adLabel")}
        </p>
        <p className="truncate text-sm text-foreground">{ad[lang]}</p>
      </div>
    </Link>
  );
}
