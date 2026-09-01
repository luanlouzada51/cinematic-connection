import type { Locale } from "@/lib/i18n";

const CURRENCY: Record<Locale, { locale: string; currency: string }> = {
  pt: { locale: "pt-BR", currency: "BRL" },
  en: { locale: "en-US", currency: "USD" },
};

export function formatMoney(value: number, locale: Locale): string {
  const config = CURRENCY[locale];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Converte "2026-08-27" em Date local, sem o pulo de fuso do `new Date(iso)`. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1);
}

export function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDate(value: string, locale: Locale): string {
  return parseDateOnly(value).toLocaleDateString(CURRENCY[locale].locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDayLabel(value: string, locale: Locale): string {
  return parseDateOnly(value).toLocaleDateString(CURRENCY[locale].locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

/** "09:00:00" -> "09:00" ou "9:00 AM", conforme o idioma. */
export function formatTime(value: string | null, locale: Locale): string {
  if (!value) return "--";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toLocaleTimeString(CURRENCY[locale].locale, {
    hour: locale === "en" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: locale === "en",
  });
}

export function formatTimestamp(value: string, locale: Locale): string {
  return new Date(value).toLocaleString(CURRENCY[locale].locale, {
    day: "2-digit",
    month: "short",
    hour: locale === "en" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: locale === "en",
  });
}

export function formatClock(value: string, locale: Locale): string {
  return new Date(value).toLocaleTimeString(CURRENCY[locale].locale, {
    hour: locale === "en" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: locale === "en",
  });
}

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Horas entre dois horários do mesmo dia. Sem fim definido, conta zero. */
export function hoursBetween(start: string, end: string | null): number {
  if (!end) return 0;
  return Math.max(minutesOfDay(end) - minutesOfDay(start), 0) / 60;
}

export function formatAddress(line?: string | null, city?: string | null): string {
  return [line, city].filter(Boolean).join(", ") || "—";
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours ?? 0) * 60 + (mins ?? 0) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
