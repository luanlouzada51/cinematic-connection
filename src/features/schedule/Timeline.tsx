import { Ban, Check, Footprints, LogIn, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatClock } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { AppointmentEvent, AppointmentEventKind } from "@/integrations/supabase/types";

const EVENT_ICON: Record<AppointmentEventKind, LucideIcon> = {
  on_my_way: Footprints,
  clock_in: LogIn,
  clock_out: LogOut,
  completed: Check,
  canceled: Ban,
};

/** Mesma leitura do papelzinho na porta: o que aconteceu e a que horas. */
export function Timeline({ events }: { events: AppointmentEvent[] }) {
  const { t, locale } = useI18n();

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("job.noTimeline")}</p>;
  }

  return (
    <ol className="grid grid-cols-2 gap-2">
      {events.map((event) => {
        const Icon = EVENT_ICON[event.kind];
        return (
          <li
            key={event.id}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted-foreground">
                {t(`event.${event.kind}`)}
              </span>
              <span className="font-medium">{formatClock(event.created_at, locale)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
