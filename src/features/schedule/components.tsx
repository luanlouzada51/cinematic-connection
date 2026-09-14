import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/integrations/supabase/types";

const STATUS_TONE: Record<
  AppointmentStatus,
  "neutral" | "info" | "success" | "danger" | "primary"
> = {
  scheduled: "neutral",
  on_my_way: "primary",
  in_progress: "info",
  completed: "success",
  canceled: "danger",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  return <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>;
}

type AppointmentCardProps = {
  appointment: Appointment;
  customerName: string;
  address: string;
  teamNames: string[];
  showPrice: boolean;
};

export function AppointmentCard({
  appointment,
  customerName,
  address,
  teamNames,
  showPrice,
}: AppointmentCardProps) {
  const { t, locale } = useI18n();

  return (
    <Link
      to="/app/schedule/$appointmentId"
      params={{ appointmentId: appointment.id }}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{customerName}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {formatTime(appointment.start_time, locale)}
            {appointment.end_time ? ` – ${formatTime(appointment.end_time, locale)}` : null}
          </p>
          <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{address}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={appointment.status} />
          {showPrice ? (
            <span className="text-sm font-semibold">{formatMoney(appointment.price, locale)}</span>
          ) : null}
        </div>
      </div>

      <p className="mt-3 truncate text-xs text-muted-foreground">
        {teamNames.length > 0 ? teamNames.join(", ") : t("schedule.unassigned")}
      </p>
    </Link>
  );
}
