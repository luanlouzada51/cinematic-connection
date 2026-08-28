import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, endOfWeek, startOfWeek } from "date-fns";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import {
  useAppointmentsInRange,
  useAssignments,
  useExtendSeries,
  useSeriesHealth,
} from "@/features/schedule/api";
import { AppointmentCard } from "@/features/schedule/components";
import { defaultOccurrenceCount, LOW_OCCURRENCE_THRESHOLD } from "@/features/schedule/recurrence";
import type { Appointment } from "@/integrations/supabase/types";
import {
  formatAddress,
  formatDate,
  formatDayLabel,
  formatMoney,
  parseDateOnly,
  toDateOnly,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/schedule/")({ component: SchedulePage });

type Mode = "day" | "week";

function SchedulePage() {
  const { t, locale } = useI18n();
  const { company, isManager, canSeePrices } = useSession();

  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(() => toDateOnly(new Date()));
  const [memberId, setMemberId] = useState("");

  const { from, to } = useMemo(() => rangeFor(mode, date), [mode, date]);

  const directory = useDirectory(company?.id);
  const appointments = useAppointmentsInRange(company?.id, from, to);
  const rows = useMemo(() => appointments.data ?? [], [appointments.data]);
  const assignments = useAssignments(rows.map((row) => row.id));

  const visible = useMemo(() => {
    if (!memberId) return rows;
    const allowed = new Set(
      (assignments.data ?? [])
        .filter((assignment) => assignment.member_id === memberId)
        .map((assignment) => assignment.appointment_id),
    );
    return rows.filter((row) => allowed.has(row.id));
  }, [rows, assignments.data, memberId]);

  const total = visible.reduce((sum, row) => sum + row.price, 0);
  const byDay = useMemo(() => groupByDate(visible), [visible]);

  function shift(direction: number) {
    setDate(toDateOnly(addDays(parseDateOnly(date), direction * (mode === "week" ? 7 : 1))));
  }

  function teamOf(appointment: Appointment): string[] {
    return (assignments.data ?? [])
      .filter((assignment) => assignment.appointment_id === appointment.id)
      .map((assignment) => directory.data?.memberById.get(assignment.member_id)?.display_name ?? "")
      .filter(Boolean);
  }

  if (!company) return <EmptyState icon={CalendarDays} title={t("error.noCompany")} />;

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

      {isManager ? <ExpiringContracts companyId={company.id} /> : null}

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "day", label: t("schedule.day") },
          { value: "week", label: t("schedule.week") },
        ]}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="-1">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          {mode === "day" ? (
            <>
              <p className="text-sm font-medium capitalize">{formatDayLabel(date, locale)}</p>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full bg-transparent text-center text-xs text-muted-foreground focus:outline-none"
              />
            </>
          ) : (
            <p className="text-sm font-medium">
              {formatDate(from, locale)} – {formatDate(to, locale)}
            </p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="+1">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
        <option value="">{t("schedule.allTeam")}</option>
        {directory.data?.members
          .filter((member) => member.active)
          .map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
      </Select>

      {appointments.isLoading || directory.isLoading ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={mode === "day" ? t("schedule.emptyDay") : t("schedule.emptyWeek")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/app/schedule/new">{t("schedule.newJob")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {byDay.map(([day, dayRows]) => (
              <section key={day} className="flex flex-col gap-2">
                {mode === "week" ? (
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatDayLabel(day, locale)}
                  </h2>
                ) : null}
                {dayRows.map((appointment) => {
                  const property = directory.data?.propertyById.get(appointment.property_id);
                  return (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      customerName={
                        directory.data?.customerById.get(appointment.customer_id)?.name ?? "—"
                      }
                      address={formatAddress(property?.address_line1, property?.city)}
                      teamNames={teamOf(appointment)}
                      showPrice={canSeePrices}
                    />
                  );
                })}
              </section>
            ))}
          </div>

          <footer className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {t("schedule.jobsCount", { count: visible.length })}
            </span>
            {canSeePrices ? (
              <span className="font-semibold">
                {mode === "day" ? t("schedule.dayTotal") : t("schedule.weekTotal")}:{" "}
                {formatMoney(total, locale)}
              </span>
            ) : null}
          </footer>
        </>
      )}
    </div>
  );
}

/**
 * Aviso de contrato acabando.
 *
 * As visitas recorrentes são geradas em lote; sem esse empurrão, a agenda de
 * um cliente fiel simplesmente some sem ninguém perceber.
 */
function ExpiringContracts({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const health = useSeriesHealth(companyId);
  const extendSeries = useExtendSeries(companyId);

  const lowContracts = (health.data ?? []).filter(
    (entry) => entry.upcoming < LOW_OCCURRENCE_THRESHOLD,
  );

  if (lowContracts.length === 0) return null;

  async function handleGenerate() {
    let created = 0;
    for (const entry of lowContracts) {
      created += await extendSeries.mutateAsync({
        series: entry.series,
        lastDate: entry.lastDate,
        count: defaultOccurrenceCount(entry.series.recurrence),
      });
    }
    toast.success(t("contract.extended", { count: created }));
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
      <p className="text-sm">{t("contract.lowBanner", { count: lowContracts.length })}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        disabled={extendSeries.isPending}
      >
        <CalendarPlus className="size-4" />
        {t("contract.generateAll")}
      </Button>
    </div>
  );
}

function rangeFor(mode: Mode, date: string): { from: string; to: string } {
  if (mode === "day") return { from: date, to: date };
  const reference = parseDateOnly(date);
  return {
    from: toDateOnly(startOfWeek(reference, { weekStartsOn: 1 })),
    to: toDateOnly(endOfWeek(reference, { weekStartsOn: 1 })),
  };
}

function groupByDate(rows: Appointment[]): Array<[string, Appointment[]]> {
  const groups = new Map<string, Appointment[]>();
  for (const row of rows) {
    const bucket = groups.get(row.scheduled_date);
    if (bucket) bucket.push(row);
    else groups.set(row.scheduled_date, [row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
