import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, MapPin, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useCompany } from "@/features/company/api";
import { useDirectory } from "@/features/company/directory";
import { useEnsureThread } from "@/features/messaging/api";
import {
  useAppointment,
  useAppointmentEvents,
  useAssignments,
  useDeleteAppointment,
  useJobPlace,
  useRegisterEvent,
  useSetAssignments,
  useUpdateAppointment,
} from "@/features/schedule/api";
import { StatusBadge } from "@/features/schedule/components";
import { Timeline } from "@/features/schedule/Timeline";
import { publicPhotoUrl, useAppointmentPhotos, useUploadPhoto } from "@/features/schedule/photos";
import type {
  AppointmentEventKind,
  PaymentCollector,
  ServiceType,
} from "@/integrations/supabase/types";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { COLLECTORS, SERVICE_TYPES } from "@/lib/enums";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/app/schedule/$appointmentId")({ component: JobDetail });

const ACTIONS: Array<{ kind: AppointmentEventKind; label: TranslationKey }> = [
  { kind: "on_my_way", label: "action.onMyWay" },
  { kind: "clock_in", label: "action.clockIn" },
  { kind: "clock_out", label: "action.clockOut" },
  { kind: "completed", label: "action.complete" },
];

function JobDetail() {
  const { appointmentId } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user, company, isManager, customerLinks } = useSession();

  const appointment = useAppointment(appointmentId);
  const events = useAppointmentEvents(appointmentId);
  const photos = useAppointmentPhotos(appointmentId);
  const assignments = useAssignments([appointmentId]);
  const directory = useDirectory(company?.id);
  const jobCompany = useCompany(appointment.data?.company_id);

  const registerEvent = useRegisterEvent(appointmentId);
  const updateAppointment = useUpdateAppointment(appointmentId);
  const setAssignments = useSetAssignments(appointmentId);
  const deleteAppointment = useDeleteAppointment();
  const uploadPhoto = useUploadPhoto(appointmentId);
  const ensureThread = useEnsureThread();

  const [notes, setNotes] = useState<string | null>(null);

  const job = appointment.data;
  const isTeam = Boolean(job && company && company.id === job.company_id);
  // O cliente não carrega o cadastro da empresa, então busca só a própria casa.
  const place = useJobPlace(
    isTeam ? undefined : job?.customer_id,
    isTeam ? undefined : job?.property_id,
  );

  if (appointment.isLoading) return <LoadingBlock />;
  if (!job) return <EmptyState title={t("job.notFound")} />;

  const isCustomerViewer = customerLinks.some((customer) => customer.id === job.customer_id);
  const customer = directory.data?.customerById.get(job.customer_id) ?? place.data?.customer;
  const property = directory.data?.propertyById.get(job.property_id) ?? place.data?.property;

  const showPrice = isTeam
    ? isManager || (jobCompany.data?.show_prices_to_workers ?? true)
    : (jobCompany.data?.show_prices_to_customers ?? true);
  const chatAllowed = jobCompany.data?.allow_customer_chat ?? true;

  const assignedMemberIds = (assignments.data ?? [])
    .filter((assignment) => assignment.appointment_id === appointmentId)
    .map((assignment) => assignment.member_id);

  const mapsQuery = encodeURIComponent(
    [property?.address_line1, property?.city, property?.state, property?.postal_code]
      .filter(Boolean)
      .join(", "),
  );

  async function handleEvent(kind: AppointmentEventKind) {
    if (!user) return;
    try {
      await registerEvent.mutateAsync({ kind, accountId: user.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.save"));
    }
  }

  const handleOpenChat = async () => {
    if (!jobCompany.data) return;
    try {
      const thread = await ensureThread.mutateAsync({
        companyId: job.company_id,
        customerId: job.customer_id,
      });
      await navigate({ to: "/app/messages/$threadId", params: { threadId: thread.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.generic"));
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{customer?.name ?? t("portal.next")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(job.scheduled_date, locale)} · {formatTime(job.start_time, locale)}
            {job.end_time ? ` – ${formatTime(job.end_time, locale)}` : null}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t(`service.${job.service_type}`)}</p>
        </div>
        <StatusBadge status={job.status} />
      </header>

      {property ? (
        <Card>
          <CardContent className="flex items-start gap-2 pt-4 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p>{property.address_line1}</p>
              <p className="text-muted-foreground">
                {[property.city, property.state, property.postal_code].filter(Boolean).join(", ")}
              </p>
              {property.access_notes ? (
                <p className="mt-1 text-xs text-muted-foreground">{property.access_notes}</p>
              ) : null}
              <a
                className="mt-2 inline-block text-xs font-medium text-primary underline"
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("job.openMaps")}
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isTeam ? (
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.kind}
              variant={action.kind === "completed" ? "success" : "outline"}
              onClick={() => handleEvent(action.kind)}
              disabled={registerEvent.isPending}
            >
              {t(action.label)}
            </Button>
          ))}
        </div>
      ) : null}

      {isManager ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("job.reschedule")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label={t("job.date")}>
              <Input
                type="date"
                defaultValue={job.scheduled_date}
                onChange={(event) =>
                  event.target.value &&
                  updateAppointment.mutate({ scheduled_date: event.target.value })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("job.startTime")}>
                <Input
                  type="time"
                  defaultValue={job.start_time.slice(0, 5)}
                  onChange={(event) =>
                    event.target.value &&
                    updateAppointment.mutate({ start_time: event.target.value })
                  }
                />
              </Field>
              <Field label={t("job.endTime")}>
                <Input
                  type="time"
                  defaultValue={job.end_time?.slice(0, 5) ?? ""}
                  onChange={(event) =>
                    updateAppointment.mutate({ end_time: event.target.value || null })
                  }
                />
              </Field>
            </div>
            <Field label={t("job.service")}>
              <Select
                value={job.service_type}
                onChange={(event) =>
                  updateAppointment.mutate({ service_type: event.target.value as ServiceType })
                }
              >
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`service.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("job.timeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={events.data ?? []} />
        </CardContent>
      </Card>

      {isTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("job.team")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {directory.data?.members
              .filter((member) => member.active)
              .map((member) => (
                <Chip
                  key={member.id}
                  label={member.display_name}
                  selected={assignedMemberIds.includes(member.id)}
                  onToggle={() => {
                    if (!isManager) return;
                    const next = assignedMemberIds.includes(member.id)
                      ? assignedMemberIds.filter((id) => id !== member.id)
                      : [...assignedMemberIds, member.id];
                    setAssignments.mutate(next);
                  }}
                />
              ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("job.billing")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("job.price")}</span>
            <span className="font-semibold">
              {showPrice ? formatMoney(job.price, locale) : t("job.priceHidden")}
            </span>
          </div>

          {isTeam ? (
            <Field label={t("job.collector")}>
              <Select
                value={job.payment_collector}
                onChange={(event) =>
                  updateAppointment.mutate({
                    payment_collector: event.target.value as PaymentCollector,
                    paid_at: event.target.value === "unpaid" ? null : new Date().toISOString(),
                  })
                }
              >
                {COLLECTORS.map((collector) => (
                  <option key={collector} value={collector}>
                    {t(`collector.${collector}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {isManager ? (
            <Field label={t("job.price")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={job.price}
                onBlur={(event) => updateAppointment.mutate({ price: Number(event.target.value) })}
              />
            </Field>
          ) : null}
        </CardContent>
      </Card>

      {isTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("common.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes ?? job.notes ?? ""}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (notes !== null && notes !== job.notes) {
                  updateAppointment.mutate({ notes: notes || null });
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("job.photos")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {photos.data && photos.data.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.data.map((photo) => (
                <img
                  key={photo.id}
                  src={publicPhotoUrl(photo.storage_path)}
                  alt={photo.caption ?? ""}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}

          {isTeam ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-primary">
              <Camera className="size-4" />
              {uploadPhoto.isPending ? t("common.saving") : t("job.addPhoto")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && user) uploadPhoto.mutate({ file, accountId: user.id });
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </CardContent>
      </Card>

      {(isTeam || isCustomerViewer) && chatAllowed ? (
        <Button variant="outline" onClick={handleOpenChat} disabled={ensureThread.isPending}>
          <MessageCircle className="size-4" />
          {isTeam ? t("job.chatWithCustomer") : t("portal.company")}
        </Button>
      ) : null}

      {isManager ? (
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={async () => {
            if (!window.confirm(t("job.deleteConfirm"))) return;
            await deleteAppointment.mutateAsync(appointmentId);
            await navigate({ to: "/app/schedule" });
          }}
        >
          <Trash2 className="size-4" />
          {t("common.delete")}
        </Button>
      ) : null}
    </div>
  );
}
