import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type {
  Appointment,
  AppointmentAssignment,
  AppointmentEvent,
  AppointmentEventKind,
  AppointmentStatus,
  PaymentCollector,
  Recurrence,
  ServiceSeries,
  ServiceType,
} from "@/integrations/supabase/types";
import { addMinutesToTime, toDateOnly } from "@/lib/format";
import {
  defaultOccurrenceCount,
  nextOccurrenceDates,
  occurrenceDates,
} from "@/features/schedule/recurrence";

export const scheduleKeys = {
  range: (companyId: string | undefined, from: string, to: string) =>
    ["appointments", companyId, from, to] as const,
  detail: (id: string) => ["appointment", id] as const,
  events: (id: string) => ["appointment-events", id] as const,
  assignments: (id: string) => ["appointment-assignments", id] as const,
  workerDay: (accountId: string | undefined, date: string) =>
    ["worker-day", accountId, date] as const,
};

/** O evento é o registro; o status é o resumo dele para a lista e para o cliente. */
const STATUS_AFTER_EVENT: Record<AppointmentEventKind, AppointmentStatus | null> = {
  on_my_way: "on_my_way",
  clock_in: "in_progress",
  clock_out: null,
  completed: "completed",
  canceled: "canceled",
};

export function useAppointmentsInRange(companyId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: scheduleKeys.range(companyId, from, to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("company_id", companyId!)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("scheduled_date")
        .order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(companyId),
  });
}

export function useAppointment(appointmentId: string) {
  return useQuery({
    queryKey: scheduleKeys.detail(appointmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAppointmentEvents(appointmentId: string) {
  return useQuery({
    queryKey: scheduleKeys.events(appointmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_events")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Cliente e casa de um serviço, para quem não carrega o cadastro inteiro da
 * empresa — é o caso do cliente olhando a própria visita.
 */
export function useJobPlace(customerId: string | undefined, propertyId: string | undefined) {
  return useQuery({
    queryKey: ["job-place", customerId, propertyId],
    queryFn: async () => {
      const [customer, property] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId!).maybeSingle(),
        supabase.from("properties").select("*").eq("id", propertyId!).maybeSingle(),
      ]);
      if (customer.error) throw customer.error;
      if (property.error) throw property.error;
      return { customer: customer.data, property: property.data };
    },
    enabled: Boolean(customerId && propertyId),
  });
}

export function useAssignments(appointmentIds: string[]) {
  const key = [...appointmentIds].sort().join(",");
  return useQuery({
    queryKey: ["assignments", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_assignments")
        .select("*")
        .in("appointment_id", appointmentIds);
      if (error) throw error;
      return data;
    },
    enabled: appointmentIds.length > 0,
  });
}

/** Serviços de um dia atribuídos a quem está usando o app. */
export function useWorkerDay(memberIds: string[], date: string, accountId: string | undefined) {
  return useQuery({
    queryKey: scheduleKeys.workerDay(accountId, date),
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from("appointment_assignments")
        .select("*")
        .in("member_id", memberIds);
      if (error) throw error;

      const ids = assignments.map((assignment) => assignment.appointment_id);
      if (ids.length === 0) return [] as Appointment[];

      const { data, error: appointmentsError } = await supabase
        .from("appointments")
        .select("*")
        .in("id", ids)
        .eq("scheduled_date", date)
        .order("start_time");
      if (appointmentsError) throw appointmentsError;
      return data;
    },
    enabled: memberIds.length > 0,
  });
}

export type NewServiceInput = {
  companyId: string;
  customerId: string;
  propertyId: string;
  serviceType: ServiceType;
  recurrence: Recurrence;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  price: number;
  notes: string;
  memberIds: string[];
  occurrences?: number;
};

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewServiceInput) => {
      const count = input.occurrences ?? defaultOccurrenceCount(input.recurrence);

      const { data: series, error: seriesError } = await supabase
        .from("service_series")
        .insert({
          company_id: input.companyId,
          customer_id: input.customerId,
          property_id: input.propertyId,
          service_type: input.serviceType,
          recurrence: input.recurrence,
          start_date: input.startDate,
          start_time: input.startTime,
          duration_minutes: input.durationMinutes,
          price: input.price,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (seriesError) throw seriesError;

      const rows = occurrenceDates(input.startDate, input.recurrence, count).map((date) => ({
        company_id: input.companyId,
        customer_id: input.customerId,
        property_id: input.propertyId,
        series_id: series.id,
        service_type: input.serviceType,
        scheduled_date: date,
        start_time: input.startTime,
        end_time: addMinutesToTime(input.startTime, input.durationMinutes),
        price: input.price,
        notes: input.notes || null,
      }));

      const { data: appointments, error } = await supabase
        .from("appointments")
        .insert(rows)
        .select();
      if (error) throw error;

      if (input.memberIds.length > 0) {
        const assignments = appointments.flatMap((appointment) =>
          input.memberIds.map((memberId) => ({
            appointment_id: appointment.id,
            member_id: memberId,
          })),
        );
        const { error: assignError } = await supabase
          .from("appointment_assignments")
          .insert(assignments);
        if (assignError) throw assignError;
      }

      return appointments;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useUpdateAppointment(appointmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Appointment>) => {
      const { error } = await supabase.from("appointments").update(patch).eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["worker-day"] });
    },
  });
}

export function useRegisterEvent(appointmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kind, accountId }: { kind: AppointmentEventKind; accountId: string }) => {
      const { error } = await supabase
        .from("appointment_events")
        .insert({ appointment_id: appointmentId, account_id: accountId, kind });
      if (error) throw error;

      const status = STATUS_AFTER_EVENT[kind];
      if (status) {
        const { error: statusError } = await supabase
          .from("appointments")
          .update({ status })
          .eq("id", appointmentId);
        if (statusError) throw statusError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.events(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["worker-day"] });
    },
  });
}

export function useSetCollector(appointmentId: string) {
  const update = useUpdateAppointment(appointmentId);

  return (collector: PaymentCollector) =>
    update.mutateAsync({
      payment_collector: collector,
      paid_at: collector === "unpaid" ? null : new Date().toISOString(),
    });
}

export function useSetAssignments(appointmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberIds: string[]) => {
      const { error: clearError } = await supabase
        .from("appointment_assignments")
        .delete()
        .eq("appointment_id", appointmentId);
      if (clearError) throw clearError;

      if (memberIds.length === 0) return;

      const { error } = await supabase
        .from("appointment_assignments")
        .insert(
          memberIds.map((memberId) => ({ appointment_id: appointmentId, member_id: memberId })),
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.assignments(appointmentId) });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Contratos recorrentes
//
// As visitas são geradas em lote na criação do contrato. Sem renovação, a
// agenda simplesmente esvazia quando o lote acaba — então a empresa precisa
// enxergar quais contratos estão no fim e conseguir esticá-los em um toque.
// ---------------------------------------------------------------------------

/** Até quanto tempo atrás procuramos a última visita de um contrato. */
const SERIES_LOOKBACK_DAYS = 120;

export type SeriesHealth = {
  series: ServiceSeries;
  /** Visitas futuras já criadas (hoje inclusive). */
  upcoming: number;
  /** Data da última visita gerada — é de onde a renovação continua. */
  lastDate: string;
};

export function useSeriesHealth(companyId: string | undefined) {
  return useQuery({
    queryKey: ["series-health", companyId],
    queryFn: async (): Promise<SeriesHealth[]> => {
      const today = toDateOnly(new Date());
      const since = toDateOnly(addDays(new Date(), -SERIES_LOOKBACK_DAYS));

      const [seriesResult, appointmentsResult] = await Promise.all([
        supabase
          .from("service_series")
          .select("*")
          .eq("company_id", companyId!)
          .eq("active", true)
          .neq("recurrence", "one_time"),
        supabase
          .from("appointments")
          .select("*")
          .eq("company_id", companyId!)
          .gte("scheduled_date", since)
          .neq("status", "canceled"),
      ]);

      if (seriesResult.error) throw seriesResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      return seriesResult.data.map((series) => {
        const own = appointmentsResult.data.filter(
          (appointment) => appointment.series_id === series.id,
        );
        const dates = own.map((appointment) => appointment.scheduled_date).sort();

        return {
          series,
          upcoming: dates.filter((date) => date >= today).length,
          lastDate: dates.at(-1) ?? series.start_date,
        };
      });
    },
    enabled: Boolean(companyId),
  });
}

export function useUpdateSeries(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ServiceSeries> }) => {
      const { error } = await supabase.from("service_series").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-series"] });
      void queryClient.invalidateQueries({ queryKey: ["series-health", companyId] });
    },
  });
}

/**
 * Cria as próximas visitas de um contrato a partir da última já existente,
 * herdando a equipe da visita mais recente — quem limpa aquela casa costuma
 * ser sempre a mesma pessoa, e refazer isso à mão a cada renovação é o tipo de
 * trabalho que faz a empresa desistir do app.
 */
export function useExtendSeries(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ series, lastDate, count }: ExtendSeriesInput) => {
      const dates = nextOccurrenceDates(lastDate, series.recurrence, count);
      if (dates.length === 0) return 0;

      const { data: latest, error: latestError } = await supabase
        .from("appointments")
        .select("*")
        .eq("series_id", series.id)
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      const memberIds = latest ? await assignedMemberIds(latest.id) : [];

      const { data: created, error } = await supabase
        .from("appointments")
        .insert(
          dates.map((date) => ({
            company_id: series.company_id,
            customer_id: series.customer_id,
            property_id: series.property_id,
            series_id: series.id,
            service_type: series.service_type,
            scheduled_date: date,
            start_time: series.start_time,
            end_time: addMinutesToTime(series.start_time, series.duration_minutes),
            price: series.price,
            notes: series.notes,
          })),
        )
        .select();
      if (error) throw error;

      if (memberIds.length > 0) {
        const { error: assignError } = await supabase.from("appointment_assignments").insert(
          created.flatMap((appointment) =>
            memberIds.map((memberId) => ({
              appointment_id: appointment.id,
              member_id: memberId,
            })),
          ),
        );
        if (assignError) throw assignError;
      }

      return created.length;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["series-health", companyId] });
    },
  });
}

export type ExtendSeriesInput = { series: ServiceSeries; lastDate: string; count: number };

async function assignedMemberIds(appointmentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointment_assignments")
    .select("*")
    .eq("appointment_id", appointmentId);
  if (error) throw error;
  return data.map((assignment) => assignment.member_id);
}

/**
 * Remove as visitas futuras ainda não iniciadas de um contrato. Usado ao pausar:
 * o que já aconteceu fica no histórico, o que estava marcado some da agenda.
 */
export function useCancelFutureOccurrences(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (seriesId: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("series_id", seriesId)
        .eq("status", "scheduled")
        .gte("scheduled_date", toDateOnly(new Date()));
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["series-health", companyId] });
    },
  });
}

export type { AppointmentAssignment, AppointmentEvent };
