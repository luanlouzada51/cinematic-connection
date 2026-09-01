import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { useCreateService } from "@/features/schedule/api";
import {
  defaultOccurrenceCount,
  occurrenceDates,
  RECURRENCES,
} from "@/features/schedule/recurrence";
import type { Recurrence, ServiceType } from "@/integrations/supabase/types";
import { toDateOnly } from "@/lib/format";
import { SERVICE_TYPES } from "@/lib/enums";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/schedule/new")({ component: NewServicePage });

function NewServicePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { company } = useSession();
  const directory = useDirectory(company?.id);
  const createService = useCreateService();

  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("standard");
  const [recurrence, setRecurrence] = useState<Recurrence>("biweekly");
  const [startDate, setStartDate] = useState(() => toDateOnly(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [occurrences, setOccurrences] = useState(() => defaultOccurrenceCount("biweekly"));

  const properties = useMemo(
    () => (customerId ? (directory.data?.propertiesByCustomer.get(customerId) ?? []) : []),
    [customerId, directory.data],
  );

  const preview = occurrenceDates(startDate, recurrence, Math.min(occurrences, 3));

  function handleRecurrenceChange(next: Recurrence) {
    setRecurrence(next);
    setOccurrences(defaultOccurrenceCount(next));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!company || !customerId || !propertyId) return;

    try {
      await createService.mutateAsync({
        companyId: company.id,
        customerId,
        propertyId,
        serviceType,
        recurrence,
        startDate,
        startTime,
        durationMinutes,
        price: Number(price || 0),
        notes,
        memberIds,
        occurrences,
      });
      toast.success(t("job.created"));
      await navigate({ to: "/app/schedule" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.save"));
    }
  }

  if (directory.data && directory.data.customers.length === 0) {
    return (
      <EmptyState
        title={t("customers.empty")}
        action={
          <Button asChild size="sm">
            <Link to="/app/clients/new">{t("customers.new")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <form className="flex flex-col gap-4 pb-8" onSubmit={handleSubmit}>
      <h1 className="text-xl font-semibold">{t("job.new")}</h1>

      <Field label={t("job.customer")}>
        <Select
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setPropertyId("");
          }}
          required
        >
          <option value="">—</option>
          {directory.data?.customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t("job.property")} hint={customerId ? undefined : t("job.selectCustomerFirst")}>
        <Select
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          disabled={!customerId}
          required
        >
          <option value="">—</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.label} — {property.address_line1}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("job.service")}>
          <Select
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value as ServiceType)}
          >
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`service.${type}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("job.recurrence")}>
          <Select
            value={recurrence}
            onChange={(event) => handleRecurrenceChange(event.target.value as Recurrence)}
          >
            {RECURRENCES.map((option) => (
              <option key={option} value={option}>
                {t(`recurrence.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("job.startDate")}>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </Field>
        <Field label={t("job.startTime")}>
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("job.duration")}>
          <Input
            type="number"
            min={15}
            step={15}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          />
        </Field>
        <Field label={t("job.price")}>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>

      {recurrence !== "one_time" ? (
        <Field label={t("job.occurrences")} hint={t("job.occurrencesHelp", { count: occurrences })}>
          <Input
            type="number"
            min={1}
            max={52}
            value={occurrences}
            onChange={(event) => setOccurrences(Number(event.target.value))}
          />
        </Field>
      ) : null}

      <p className="text-xs text-muted-foreground">{preview.join(" · ")}</p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("job.team")}</span>
        <div className="flex flex-wrap gap-2">
          {directory.data?.members
            .filter((member) => member.active)
            .map((member) => (
              <Chip
                key={member.id}
                label={member.display_name}
                selected={memberIds.includes(member.id)}
                onToggle={() =>
                  setMemberIds((current) =>
                    current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : [...current, member.id],
                  )
                }
              />
            ))}
        </div>
      </div>

      <Field label={t("common.notes")}>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" block disabled={createService.isPending}>
          {createService.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/schedule">{t("common.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
