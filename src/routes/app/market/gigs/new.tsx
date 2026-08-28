import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useCreateGig } from "@/features/marketplace/api";
import { SkillPicker } from "@/features/marketplace/components";
import type { CleaningSkill, PayModel } from "@/integrations/supabase/types";
import { toDateOnly } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/market/gigs/new")({ component: NewGigPage });

const PAY_MODELS: PayModel[] = ["daily", "hourly", "percentage"];

function NewGigPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, company } = useSession();
  const createGig = useCreateGig();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(company?.city ?? "");
  const [state, setState] = useState(company?.state ?? "");
  const [date, setDate] = useState(() => toDateOnly(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [skills, setSkills] = useState<CleaningSkill[]>([]);
  const [headcount, setHeadcount] = useState(1);
  const [payModel, setPayModel] = useState<PayModel>(company?.default_pay_model ?? "daily");
  const [dailyRate, setDailyRate] = useState(company?.default_daily_rate?.toString() ?? "");
  const [hourlyRate, setHourlyRate] = useState(company?.default_hourly_rate?.toString() ?? "");
  const [percentage, setPercentage] = useState(
    company?.default_worker_percentage?.toString() ?? "80",
  );

  if (!company || !user) return <EmptyState title={t("error.noCompany")} />;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!company || !user) return;

    try {
      const gig = await createGig.mutateAsync({
        companyId: company.id,
        createdBy: user.id,
        title,
        description,
        city,
        state,
        date,
        startTime,
        endTime,
        requiredSkills: skills,
        headcount,
        payModel,
        dailyRate: payModel === "daily" ? Number(dailyRate || 0) : null,
        hourlyRate: payModel === "hourly" ? Number(hourlyRate || 0) : null,
        workerPercentage: payModel === "percentage" ? Number(percentage || 0) : null,
      });
      toast.success(t("gig.created"));
      await navigate({ to: "/app/market/gigs/$gigId", params: { gigId: gig.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.save"));
    }
  }

  return (
    <form className="flex flex-col gap-4 pb-8" onSubmit={handleSubmit}>
      <h1 className="text-xl font-semibold">{t("market.postGig")}</h1>

      <Field label={t("gig.title")}>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
      </Field>

      <Field label={t("gig.description")}>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label={t("gig.date")}>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
        <Field label={t("gig.startTime")}>
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Field>
        <Field label={t("gig.endTime")}>
          <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label={t("gig.city")} className="col-span-2">
          <Input value={city} onChange={(event) => setCity(event.target.value)} />
        </Field>
        <Field label={t("property.state")}>
          <Input value={state} onChange={(event) => setState(event.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("gig.skills")}</span>
        <SkillPicker selected={skills} onChange={setSkills} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("gig.headcount")}>
          <Input
            type="number"
            min={1}
            value={headcount}
            onChange={(event) => setHeadcount(Number(event.target.value))}
          />
        </Field>
        <Field label={t("gig.payModel")}>
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
      </div>

      {payModel === "daily" ? (
        <Field label={t("gig.dailyRate")}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={dailyRate}
            onChange={(event) => setDailyRate(event.target.value)}
          />
        </Field>
      ) : payModel === "hourly" ? (
        <Field label={t("gig.hourlyRate")}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={hourlyRate}
            onChange={(event) => setHourlyRate(event.target.value)}
          />
        </Field>
      ) : (
        <Field label={t("gig.percentage")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={percentage}
            onChange={(event) => setPercentage(event.target.value)}
          />
        </Field>
      )}

      <div className="flex gap-2">
        <Button type="submit" block disabled={createGig.isPending}>
          {createGig.isPending ? t("common.saving") : t("gig.create")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/market">{t("common.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
