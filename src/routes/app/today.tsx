import { createFileRoute } from "@tanstack/react-router";
import { addDays } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { useWorkerDay } from "@/features/schedule/api";
import { AppointmentCard } from "@/features/schedule/components";
import { formatAddress, formatDayLabel, parseDateOnly, toDateOnly } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/today")({ component: WorkerDayPage });

function WorkerDayPage() {
  const { t, locale } = useI18n();
  const { user, company, member, canSeePrices } = useSession();
  const [date, setDate] = useState(() => toDateOnly(new Date()));

  const directory = useDirectory(company?.id);
  const day = useWorkerDay(member ? [member.id] : [], date, user?.id);

  function shiftDay(days: number) {
    setDate(toDateOnly(addDays(parseDateOnly(date), days)));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("worker.todayTitle")}</h1>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="-1">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <p className="text-sm font-medium capitalize">{formatDayLabel(date, locale)}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="+1">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {day.isLoading ? (
        <LoadingBlock />
      ) : (day.data?.length ?? 0) === 0 ? (
        <EmptyState icon={CalendarDays} title={t("worker.todayEmpty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {day.data?.map((appointment) => {
            const property = directory.data?.propertyById.get(appointment.property_id);
            return (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                customerName={
                  directory.data?.customerById.get(appointment.customer_id)?.name ?? "—"
                }
                address={formatAddress(property?.address_line1, property?.city)}
                teamNames={[]}
                showPrice={canSeePrices}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
