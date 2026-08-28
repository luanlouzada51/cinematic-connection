import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  Appointment,
  AppointmentAssignment,
  AppointmentEvent,
  AppointmentEventKind,
  AppointmentStatus,
  PaymentCollector,
  Recurrence,
  ServiceType,
} from "@/integrations/supabase/types";
import { addMinutesToTime } from "@/lib/format";
import { defaultOccurrenceCount, occurrenceDates } from "@/features/schedule/recurrence";

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

export type { AppointmentAssignment, AppointmentEvent };
