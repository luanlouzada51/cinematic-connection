import { Languages } from "lucide-react";

import { useI18n } from "@/lib/i18n";

/** Troca pt/en em um toque — o app é usado por times bilíngues. */
export function LocaleToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "pt" ? "en" : "pt")}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Languages className="size-4" />
      {locale === "pt" ? "PT" : "EN"}
    </button>
  );
}
