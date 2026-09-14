import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SwitchRow } from "@/components/ui/switch";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { useMarketWorkers } from "@/features/marketplace/api";
import {
  useAddAdjustment,
  useAdjustments,
  useClosePeriod,
  usePayoutPeriod,
  usePeriodGigs,
  usePeriodJobs,
  useUpdatePeriod,
} from "@/features/payouts/api";
import {
  gigEarning,
  settlePeriod,
  type SettlementGig,
  type SettlementJob,
} from "@/features/payouts/settlement";
import { formatDate, formatMoney, hoursBetween } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/payouts/$periodId")({ component: PayoutDetail });

function PayoutDetail() {
  const { periodId } = Route.useParams();
  const { t, locale } = useI18n();
  const { company, isManager } = useSession();

  const period = usePayoutPeriod(periodId);
  const jobs = usePeriodJobs(period.data);
  const adjustments = useAdjustments(periodId);
  const directory = useDirectory(company?.id);
  const marketWorkers = useMarketWorkers(company?.id);

  // O acerto é de alguém da equipe ou de alguém contratado pelo mercado; as
  // vagas são buscadas pela conta, que é o que os dois casos têm em comum.
  const member = period.data?.member_id
    ? directory.data?.memberById.get(period.data.member_id)
    : undefined;
  const accountId = period.data?.worker_account_id ?? member?.account_id ?? undefined;
  const gigs = usePeriodGigs(period.data, accountId);
  const addAdjustment = useAddAdjustment(periodId);
  const updatePeriod = useUpdatePeriod(periodId);
  const closePeriod = useClosePeriod(periodId);

  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const settlementJobs = useMemo<SettlementJob[]>(
    () =>
      (jobs.data ?? []).map((job) => ({
        id: job.id,
        label: directory.data?.customerById.get(job.customer_id)?.name ?? "—",
        date: job.scheduled_date,
        price: job.price,
        collector: job.payment_collector,
      })),
    [jobs.data, directory.data],
  );

  // A hora trabalhada sai do horário planejado do serviço: é o dado que existe
  // para todo mundo, inclusive quando o profissional esquece de bater ponto.
  const hoursWorked = useMemo(
    () =>
      (jobs.data ?? []).reduce(
        (total, job) => total + hoursBetween(job.start_time, job.end_time),
        0,
      ),
    [jobs.data],
  );

  const settlementGigs = useMemo<SettlementGig[]>(
    () =>
      (gigs.data ?? []).map(({ gig, bond }) => ({
        id: gig.id,
        label: gig.title,
        date: gig.date,
        model: bond.agreed_pay_model,
        dailyRate: bond.agreed_daily_rate,
        hourlyRate: bond.agreed_hourly_rate,
        percentage: bond.agreed_percentage,
        hours: hoursBetween(gig.start_time, gig.end_time),
        revenue: bond.house_revenue,
        collector: bond.collected_by,
      })),
    [gigs.data],
  );

  const settlement = useMemo(() => {
    if (!period.data) return null;
    return settlePeriod({
      model: period.data.pay_model,
      workerPercentage: period.data.worker_percentage,
      dailyRate: period.data.daily_rate,
      hourlyRate: period.data.hourly_rate,
      hoursWorked,
      jobs: settlementJobs,
      gigs: settlementGigs,
      adjustments: (adjustments.data ?? []).map((item) => ({
        label: item.label,
        amount: item.amount,
      })),
      includeUnpaidInSplit: includeUnpaid,
    });
  }, [period.data, settlementJobs, settlementGigs, adjustments.data, includeUnpaid, hoursWorked]);

  if (period.isLoading || jobs.isLoading) return <LoadingBlock />;
  if (!period.data || !settlement) return <EmptyState title={t("payout.empty")} />;

  const personName =
    member?.display_name ??
    marketWorkers.data?.find((worker) => worker.id === period.data?.worker_account_id)?.full_name ??
    "";
  const settled = period.data.status === "settled";

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{personName}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(period.data.start_date, locale)} –{" "}
              {formatDate(period.data.end_date, locale)}
            </p>
          </div>
          <Badge tone={settled ? "success" : "neutral"}>
            {settled ? t("payout.settled") : t(`payModel.${period.data.pay_model}`)}
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("payout.houses")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {settlementJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("payout.noHouses")}</p>
          ) : (
            settlementJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(job.date, locale)} · {t(`collector.${job.collector}`)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatMoney(job.price, locale)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("payout.gigs")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {settlementGigs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("payout.noGigs")}</p>
          ) : (
            settlementGigs.map((gig) => (
              <div key={gig.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{gig.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(gig.date, locale)} · {t(`payModel.${gig.model}`)} ·{" "}
                    {t(`collector.${gig.collector}`)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">
                  {formatMoney(gigEarning(gig), locale)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {isManager && !settled ? (
        <Card>
          <CardContent className="pt-2">
            <SwitchRow
              label={t("payout.includeUnpaid")}
              description={t("payout.includeUnpaidHelp")}
              checked={includeUnpaid}
              onCheckedChange={setIncludeUnpaid}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("payout.settlement")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row label={t("payout.gross")} value={formatMoney(settlement.gross, locale)} />
          <Row
            label={t("payout.collectedByWorker")}
            value={formatMoney(settlement.collectedByWorker, locale)}
          />
          <Row
            label={t("payout.collectedByCompany")}
            value={formatMoney(settlement.collectedByCompany, locale)}
          />
          {settlement.unpaid > 0 ? (
            <Row label={t("payout.pending")} value={formatMoney(settlement.unpaid, locale)} muted />
          ) : null}
          {settlement.gigsBase > 0 ? (
            <Row
              label={t("payout.gigsTotal")}
              value={formatMoney(settlement.gigsBase, locale)}
              muted
            />
          ) : null}
          {period.data.pay_model === "daily" ? (
            <Row label={t("payout.daysWorked")} value={String(settlement.daysWorked)} muted />
          ) : null}

          <div className="my-1 border-t border-border" />

          <Row
            label={t("payout.workerDue")}
            value={formatMoney(settlement.workerDue, locale)}
            strong
          />
          <Row
            label={t("payout.companyDue")}
            value={formatMoney(settlement.companyDue, locale)}
            strong
          />

          <div
            className={
              settlement.direction === "balanced"
                ? "mt-2 rounded-lg bg-muted px-3 py-3"
                : "mt-2 rounded-lg bg-primary/10 px-3 py-3"
            }
          >
            <p className="flex items-center gap-2 font-medium">
              <ArrowLeftRight className="size-4 shrink-0 text-primary" />
              {settlement.direction === "balanced"
                ? t("payout.balanced")
                : settlement.direction === "company_pays_worker"
                  ? t("payout.companyPaysWorker", {
                      amount: formatMoney(Math.abs(settlement.balance), locale),
                    })
                  : t("payout.workerPaysCompany", {
                      amount: formatMoney(Math.abs(settlement.balance), locale),
                    })}
            </p>
          </div>

          {settlement.unpaid > 0 ? (
            <p className="text-xs text-muted-foreground">{t("payout.pendingNote")}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("payout.adjustments")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(adjustments.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{item.label}</span>
              <span className={item.amount < 0 ? "text-destructive" : "text-success"}>
                {formatMoney(item.amount, locale)}
              </span>
            </div>
          ))}

          {isManager && !settled ? (
            <form
              className="flex items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await addAdjustment.mutateAsync({ label, amount: Number(amount || 0) });
                setLabel("");
                setAmount("");
              }}
            >
              <Field label={t("payout.adjustmentLabel")} className="flex-1">
                <Input value={label} onChange={(event) => setLabel(event.target.value)} required />
              </Field>
              <Field label={t("payout.adjustmentAmount")} className="w-32">
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </Field>
              <Button type="submit" size="icon" disabled={addAdjustment.isPending}>
                <Plus className="size-4" />
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {isManager ? (
        settled ? (
          <Button
            variant="outline"
            onClick={() => updatePeriod.mutate({ status: "open", settled_at: null })}
          >
            {t("payout.reopen")}
          </Button>
        ) : (
          <Button
            onClick={async () => {
              await closePeriod.mutateAsync({
                jobs: settlementJobs,
                gigs: settlementGigs,
                settlement,
              });
              toast.success(t("payout.settled"));
            }}
            disabled={closePeriod.isPending}
          >
            {t("payout.markSettled")}
          </Button>
        )
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={strong ? "font-semibold" : muted ? "text-muted-foreground" : ""}>
        {value}
      </span>
    </div>
  );
}
