import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { pt } from "@/lib/locales/pt";
import { en } from "@/lib/locales/en";

export type Locale = "pt" | "en";
export type TranslationKey = keyof typeof pt;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { pt, en };

const STORAGE_KEY = "cleanconnect.locale";

type Vars = Record<string, string | number>;

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
};

const I18nContext = createContext<I18nValue>({
  locale: "pt",
  setLocale: () => {},
  t: (key) => pt[key],
});

function detectLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "pt" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en";
}

/** Substitui {nome} pelos valores passados em `vars`. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt");

  // O idioma real só é conhecido no cliente; o servidor renderiza em pt.
  useEffect(() => setLocaleState(detectLocale()), []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => interpolate(dictionaries[locale][key] ?? key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
