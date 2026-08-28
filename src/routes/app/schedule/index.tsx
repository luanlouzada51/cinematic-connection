import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { useAppointmentsInRange, useAssignments } from "@/features/schedule/api";
import { AppointmentCard } from "@/features/schedule/components";
import {
  formatAddress,
  formatDayLabel,
  formatMoney,
  parseDateOnly,
  toDateOnly,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/schedule/")({ component: SchedulePage });

function SchedulePage() {
  const { t, locale } = useI18n();
  const { company, canSeePrices } = useSession();
  const [date, setDate] = useState(() => toDateOnly(new Date()));

  const directory = useDirectory(company?.id);
  const appointments = useAppointmentsInRange(company?.id, date, date);
  const rows = useMemo(() => appointments.data ?? [], [appointments.data]);
  const assignments = useAssignments(rows.map((row) => row.id));

  const dayTotal = rows.reduce((total, row) => total + row.price, 0);

  function shiftDay(days: number) {
    setDate(toDateOnly(addDays(parseDateOnly(date), days)));
  }

  if (!company) {
    return <EmptyState icon={CalendarDays} title={t("error.noCompany")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("schedule.title")}</h1>
        <Button asChild size="sm">
          <Link to="/app/schedule/new">
            <Plus className="size-4" />
            {t("schedule.newJob")}
          </Link>
        </Button>
      </header>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="-1">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <p className="text-sm font-medium capitalize">{formatDayLabel(date, locale)}</p>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full bg-transparent text-center text-xs text-muted-foreground focus:outline-none"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="+1">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {appointments.isLoading || directory.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("schedule.emptyDay")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/app/schedule/new">{t("schedule.newJob")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((appointment) => {
              const property = directory.data?.propertyById.get(appointment.property_id);
              const teamNames = (assignments.data ?? [])
                .filter((assignment) => assignment.appointment_id === appointment.id)
                .map(
                  (assignment) =>
                    directory.data?.memberById.get(assignment.member_id)?.display_name ?? "",
                )
                .filter(Boolean);

              return (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  customerName={
                    directory.data?.customerById.get(appointment.customer_id)?.name ?? "—"
                  }
                  address={formatAddress(property?.address_line1, property?.city)}
                  teamNames={teamNames}
                  showPrice={canSeePrices}
                />
              );
            })}
          </div>

          <footer className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {t("schedule.jobsCount", { count: rows.length })}
            </span>
            {canSeePrices ? (
              <span className="font-semibold">
                {t("schedule.dayTotal")}: {formatMoney(dayTotal, locale)}
              </span>
            ) : null}
          </footer>
        </>
      )}
    </div>
  );
}
