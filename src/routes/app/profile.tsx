import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SwitchRow } from "@/components/ui/switch";
import { Stars } from "@/components/ui/stars";
import { LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import {
  useAvailability,
  useRemoveAvailability,
  useSaveWorkerProfile,
  useSetAvailability,
  useWorkerProfile,
} from "@/features/marketplace/api";
import { SkillPicker } from "@/features/marketplace/components";
import { AVAILABILITY_PERIODS } from "@/features/marketplace/constants";
import type { AvailabilityPeriod, CleaningSkill } from "@/integrations/supabase/types";
import { formatDate, toDateOnly } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/profile")({ component: WorkProfilePage });

function WorkProfilePage() {
  const { t, locale } = useI18n();
  const { user } = useSession();

  const profile = useWorkerProfile(user?.id);
  const saveProfile = useSaveWorkerProfile(user?.id);
  const availability = useAvailability(user?.id);
  const setAvailability = useSetAvailability(user?.id);
  const removeAvailability = useRemoveAvailability(user?.id);

  const [date, setDate] = useState(() => toDateOnly(new Date()));
  const [period, setPeriod] = useState<AvailabilityPeriod>("full_day");

  if (profile.isLoading) return <LoadingBlock />;

  const current = profile.data;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("worker.profileTitle")}</h1>
        {current ? (
          <div className="flex items-center gap-2">
            <Stars value={current.rating_avg} />
            <span className="text-xs text-muted-foreground">
              {current.rating_count > 0 ? current.rating_avg.toFixed(1) : t("worker.noReviews")}
            </span>
          </div>
        ) : null}
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Field label={t("worker.headline")}>
            <Input
              defaultValue={current?.headline ?? ""}
              onBlur={(event) => saveProfile.mutate({ headline: event.target.value || null })}
            />
          </Field>
          <Field label={t("worker.bio")}>
            <Textarea
              defaultValue={current?.bio ?? ""}
              onBlur={(event) => saveProfile.mutate({ bio: event.target.value || null })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("worker.experience")}>
              <Input
                type="number"
                min={0}
                defaultValue={current?.years_experience ?? ""}
                onBlur={(event) =>
                  saveProfile.mutate({
                    years_experience: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
            <Field label={t("worker.radius")}>
              <Input
                type="number"
                min={0}
                defaultValue={current?.radius_km ?? 30}
                onBlur={(event) => saveProfile.mutate({ radius_km: Number(event.target.value) })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("worker.skills")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillPicker
            selected={(current?.skills ?? []) as CleaningSkill[]}
            onChange={(skills) => saveProfile.mutate({ skills })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("gig.payModel")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("gig.dailyRate")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={current?.daily_rate ?? ""}
                onBlur={(event) =>
                  saveProfile.mutate({
                    daily_rate: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
            <Field label={t("gig.hourlyRate")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={current?.hourly_rate ?? ""}
                onBlur={(event) =>
                  saveProfile.mutate({
                    hourly_rate: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
          </div>
          <SwitchRow
            label={t("worker.acceptsPercentage")}
            checked={current?.accepts_percentage ?? true}
            onCheckedChange={(checked) => saveProfile.mutate({ accepts_percentage: checked })}
          />
          {current?.accepts_percentage !== false ? (
            <Field label={t("worker.minPercentage")}>
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={current?.min_percentage ?? ""}
                onBlur={(event) =>
                  saveProfile.mutate({
                    min_percentage: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
          ) : null}
          <SwitchRow
            label={t("worker.hasCar")}
            checked={current?.has_car ?? false}
            onCheckedChange={(checked) => saveProfile.mutate({ has_car: checked })}
          />
          <SwitchRow
            label={t("worker.visible")}
            description={t("worker.visibleHelp")}
            checked={current?.visible ?? true}
            onCheckedChange={(checked) => saveProfile.mutate({ visible: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("worker.availability")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("worker.availabilityHelp")}</p>
          <div className="flex items-end gap-2">
            <Field label={t("common.date")} className="flex-1">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label={t("common.time")} className="flex-1">
              <Select
                value={period}
                onChange={(event) => setPeriod(event.target.value as AvailabilityPeriod)}
              >
                {AVAILABILITY_PERIODS.map((option) => (
                  <option key={option} value={option}>
                    {t(`period.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              onClick={async () => {
                await setAvailability.mutateAsync({ date, period });
                toast.success(t("common.saved"));
              }}
              size="icon"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(availability.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("worker.noAvailability")}</p>
            ) : (
              availability.data?.map((slot) => (
                <span key={slot.id} className="flex items-center gap-1">
                  <Badge tone="primary">
                    {formatDate(slot.date, locale)} · {t(`period.${slot.period}`)}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => removeAvailability.mutate(slot.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t("common.remove")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
