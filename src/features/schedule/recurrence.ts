import { addDays, addMonths } from "date-fns";

import { parseDateOnly, toDateOnly } from "@/lib/format";
import type { Recurrence } from "@/integrations/supabase/types";

const INTERVAL_IN_DAYS: Partial<Record<Recurrence, number>> = {
  weekly: 7,
  biweekly: 14,
  every_3_weeks: 21,
  every_4_weeks: 28,
};

export const RECURRENCES: Recurrence[] = [
  "one_time",
  "weekly",
  "biweekly",
  "every_3_weeks",
  "every_4_weeks",
  "monthly",
];

/**
 * Datas das próximas visitas de um contrato.
 *
 * Cada ocorrência vira uma linha própria na agenda: é o que permite remarcar ou
 * cobrar um valor diferente em uma visita específica sem mexer no contrato.
 */
export function occurrenceDates(
  startDate: string,
  recurrence: Recurrence,
  count: number,
): string[] {
  if (recurrence === "one_time") return [startDate];

  const start = parseDateOnly(startDate);
  const dates: string[] = [];

  for (let index = 0; index < count; index += 1) {
    if (recurrence === "monthly") {
      dates.push(toDateOnly(addMonths(start, index)));
      continue;
    }
    const step = INTERVAL_IN_DAYS[recurrence] ?? 7;
    dates.push(toDateOnly(addDays(start, step * index)));
  }

  return dates;
}

/**
 * Datas seguintes a uma visita já existente, mantendo a mesma cadência.
 *
 * É o que renova um contrato: a contagem continua de onde a agenda parou, em
 * vez de recomeçar da data original e repetir dias que já passaram.
 */
export function nextOccurrenceDates(
  lastDate: string,
  recurrence: Recurrence,
  count: number,
): string[] {
  if (recurrence === "one_time") return [];
  return occurrenceDates(lastDate, recurrence, count + 1).slice(1);
}

/** Abaixo disso um contrato ativo é considerado "acabando". */
export const LOW_OCCURRENCE_THRESHOLD = 3;

/** Quantas visitas adiantar por padrão ao criar um contrato. */
export function defaultOccurrenceCount(recurrence: Recurrence): number {
  switch (recurrence) {
    case "one_time":
      return 1;
    case "weekly":
      return 12;
    case "biweekly":
      return 8;
    case "monthly":
      return 6;
    default:
      return 6;
  }
}
