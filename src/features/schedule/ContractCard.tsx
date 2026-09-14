import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  useCancelFutureOccurrences,
  useExtendSeries,
  useUpdateSeries,
} from "@/features/schedule/api";
import {
  defaultOccurrenceCount,
  LOW_OCCURRENCE_THRESHOLD,
  RECURRENCES,
} from "@/features/schedule/recurrence";
import type { Recurrence, ServiceSeries } from "@/integrations/supabase/types";
import { formatDate, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

type Props = {
  series: ServiceSeries;
  companyId: string | undefined;
  /** Quantas visitas futuras já existem na agenda para este contrato. */
  upcoming: number;
  lastDate: string;
  editable: boolean;
};

export function ContractCard({ series, companyId, upcoming, lastDate, editable }: Props) {
  const { t, locale } = useI18n();
  const updateSeries = useUpdateSeries(companyId);
  const extendSeries = useExtendSeries(companyId);
  const cancelFuture = useCancelFutureOccurrences(companyId);

  const [count, setCount] = useState(() => defaultOccurrenceCount(series.recurrence));

  const repeats = series.recurrence !== "one_time";
  const runningOut = repeats && series.active && upcoming < LOW_OCCURRENCE_THRESHOLD;

  async function handleExtend() {
    const created = await extendSeries.mutateAsync({ series, lastDate, count });
    toast.success(t("contract.extended", { count: created }));
  }

  async function handleToggleActive(active: boolean) {
    await updateSeries.mutateAsync({ id: series.id, patch: { active } });
    if (!active && window.confirm(t("contract.removeFutureConfirm"))) {
      await cancelFuture.mutateAsync(series.id);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t(`recurrence.${series.recurrence}`)}</p>
            <p className="text-xs text-muted-foreground">{t(`service.${series.service_type}`)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm font-semibold">{formatMoney(series.price, locale)}</span>
            {!series.active ? (
              <Badge tone="neutral">{t("contract.paused")}</Badge>
            ) : runningOut ? (
              <Badge tone="warning">{t("contract.ending")}</Badge>
            ) : null}
          </div>
        </div>

        {repeats ? (
          <p className="text-xs text-muted-foreground">
            {t("contract.upcoming", { count: upcoming })} ·{" "}
            {t("contract.lastVisit", { date: formatDate(lastDate, locale) })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("contract.oneTime")}</p>
        )}

        {editable ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("job.recurrence")}>
                <Select
                  value={series.recurrence}
                  onChange={(event) =>
                    updateSeries.mutate({
                      id: series.id,
                      patch: { recurrence: event.target.value as Recurrence },
                    })
                  }
                >
                  {RECURRENCES.map((option) => (
                    <option key={option} value={option}>
                      {t(`recurrence.${option}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("job.startTime")}>
                <Input
                  type="time"
                  defaultValue={series.start_time.slice(0, 5)}
                  onBlur={(event) =>
                    updateSeries.mutate({
                      id: series.id,
                      patch: { start_time: event.target.value },
                    })
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t("job.price")}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={series.price}
                  onBlur={(event) =>
                    updateSeries.mutate({
                      id: series.id,
                      patch: { price: Number(event.target.value) },
                    })
                  }
                />
              </Field>
              <Field label={t("job.duration")}>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  defaultValue={series.duration_minutes}
                  onBlur={(event) =>
                    updateSeries.mutate({
                      id: series.id,
                      patch: { duration_minutes: Number(event.target.value) },
                    })
                  }
                />
              </Field>
            </div>

            {repeats ? (
              <div className="flex items-end gap-2">
                <Field label={t("contract.howMany")} className="w-28">
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                  />
                </Field>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleExtend}
                  disabled={extendSeries.isPending}
                >
                  <CalendarPlus className="size-4" />
                  {t("contract.extend")}
                </Button>
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => handleToggleActive(!series.active)}
            >
              {series.active ? t("contract.pause") : t("contract.resume")}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
