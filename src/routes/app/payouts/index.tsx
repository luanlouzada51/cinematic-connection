import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { endOfWeek, startOfWeek, subDays } from "date-fns";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { useMarketWorkers } from "@/features/marketplace/api";
import {
  useCreatePayoutPeriod,
  useMyPayoutPeriods,
  usePayoutPeriods,
} from "@/features/payouts/api";
import type { PayModel, PayoutPeriod } from "@/integrations/supabase/types";
import { formatDate, toDateOnly } from "@/lib/format";
import { PAY_MODELS } from "@/lib/enums";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/payouts/")({ component: PayoutsPage });

function PayoutsPage() {
  const { isManager } = useSession();
  return isManager ? <CompanyPayouts /> : <WorkerPayouts />;
}

function CompanyPayouts() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { company } = useSession();

  const directory = useDirectory(company?.id);
  const periods = usePayoutPeriods(company?.id);
  const marketWorkers = useMarketWorkers(company?.id);
  const createPeriod = useCreatePayoutPeriod();

  const today = new Date();
  // "member:<id>" para quem é da equipe, "worker:<id>" para quem veio do mercado.
  const [subject, setSubject] = useState("");
  const [startDate, setStartDate] = useState(() =>
    toDateOnly(startOfWeek(today, { weekStartsOn: 1 })),
  );
  const [endDate, setEndDate] = useState(() => toDateOnly(endOfWeek(today, { weekStartsOn: 1 })));
  const [payModel, setPayModel] = useState<PayModel>(company?.default_pay_model ?? "percentage");
  const [percentage, setPercentage] = useState(
    company?.default_worker_percentage?.toString() ?? "80",
  );
  const [dailyRate, setDailyRate] = useState(company?.default_daily_rate?.toString() ?? "");
  const [hourlyRate, setHourlyRate] = useState(company?.default_hourly_rate?.toString() ?? "");

  /** Presets porque o período muda de empresa para empresa. */
  function applyPreset(preset: "monFri" | "sunSat" | "last7") {
    if (preset === "monFri") {
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      setStartDate(toDateOnly(monday));
      setEndDate(toDateOnly(subDays(endOfWeek(today, { weekStartsOn: 1 }), 2)));
      return;
    }
    if (preset === "sunSat") {
      setStartDate(toDateOnly(startOfWeek(today, { weekStartsOn: 0 })));
      setEndDate(toDateOnly(endOfWeek(today, { weekStartsOn: 0 })));
      return;
    }
    setStartDate(toDateOnly(subDays(today, 6)));
    setEndDate(toDateOnly(today));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!company || !subject) return;

    const [kind, id] = subject.split(":");

    try {
      const period = await createPeriod.mutateAsync({
        companyId: company.id,
        memberId: kind === "member" ? (id ?? null) : null,
        workerAccountId: kind === "worker" ? (id ?? null) : null,
        startDate,
        endDate,
        payModel,
        workerPercentage: payModel === "percentage" ? Number(percentage || 0) : null,
        dailyRate: payModel === "daily" ? Number(dailyRate || 0) : null,
        hourlyRate: payModel === "hourly" ? Number(hourlyRate || 0) : null,
      });
      await navigate({ to: "/app/payouts/$periodId", params: { periodId: period.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.save"));
    }
  }

  if (!company) return <EmptyState icon={Wallet} title={t("error.noCompany")} />;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className="text-xl font-semibold">{t("payout.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("payout.new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={handleCreate}>
            <Field label={t("payout.person")}>
              <Select value={subject} onChange={(event) => setSubject(event.target.value)} required>
                <option value="">—</option>
                <optgroup label={t("payout.teamGroup")}>
                  {directory.data?.members.map((member) => (
                    <option key={member.id} value={`member:${member.id}`}>
                      {member.display_name}
                    </option>
                  ))}
                </optgroup>
                {(marketWorkers.data?.length ?? 0) > 0 ? (
                  <optgroup label={t("payout.marketGroup")}>
                    {marketWorkers.data?.map((worker) => (
                      <option key={worker.id} value={`worker:${worker.id}`}>
                        {worker.full_name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("monFri")}
              >
                {t("payout.presetMonFri")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("sunSat")}
              >
                {t("payout.presetSunSat")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("last7")}
              >
                {t("payout.presetLast7")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("payout.from")}>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </Field>
              <Field label={t("payout.to")}>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("payout.model")}>
                <Select
                  value={payModel}
                  onChange={(event) => setPayModel(event.target.value as PayModel)}
                >
                  {PAY_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {t(`payModel.${model}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              {payModel === "percentage" ? (
                <Field label={t("payout.percentage")}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={percentage}
                    onChange={(event) => setPercentage(event.target.value)}
                  />
                </Field>
              ) : payModel === "daily" ? (
                <Field label={t("payout.dailyRate")}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={dailyRate}
                    onChange={(event) => setDailyRate(event.target.value)}
                  />
                </Field>
              ) : (
                <Field label={t("payout.hourlyRate")}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                  />
                </Field>
              )}
            </div>

            <Button type="submit" block disabled={createPeriod.isPending}>
              {t("payout.generate")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {periods.isLoading ? (
        <LoadingBlock />
      ) : (periods.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Wallet} title={t("payout.empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {periods.data?.map((period) => (
            <PeriodRow
              key={period.id}
              period={period}
              name={
                (period.member_id
                  ? directory.data?.memberById.get(period.member_id)?.display_name
                  : marketWorkers.data?.find((worker) => worker.id === period.worker_account_id)
                      ?.full_name) ?? "—"
              }
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerPayouts() {
  const { t, locale } = useI18n();
  const { user, member } = useSession();
  const periods = useMyPayoutPeriods(member ? [member.id] : [], user?.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("payout.myEarnings")}</h1>

      {periods.isLoading ? (
        <LoadingBlock />
      ) : (periods.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Wallet} title={t("payout.noPeriods")} />
      ) : (
        <div className="flex flex-col gap-2">
          {periods.data?.map((period) => (
            <PeriodRow
              key={period.id}
              period={period}
              name={member?.display_name ?? ""}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PeriodRow({
  period,
  name,
  locale,
}: {
  period: PayoutPeriod;
  name: string;
  locale: "pt" | "en";
}) {
  const { t } = useI18n();

  return (
    <Link
      to="/app/payouts/$periodId"
      params={{ periodId: period.id }}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(period.start_date, locale)} – {formatDate(period.end_date, locale)}
        </p>
      </div>
      <Badge tone={period.status === "settled" ? "success" : "neutral"}>
        {period.status === "settled" ? t("payout.settled") : t(`payModel.${period.pay_model}`)}
      </Badge>
    </Link>
  );
}
