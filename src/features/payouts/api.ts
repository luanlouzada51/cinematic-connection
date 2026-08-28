import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Appointment, PayModel, PayoutPeriod } from "@/integrations/supabase/types";
import type { Settlement, SettlementJob } from "@/features/payouts/settlement";

export const payoutKeys = {
  list: (companyId: string | undefined) => ["payout-periods", companyId] as const,
  mine: (memberIds: string[]) => ["payout-periods-mine", memberIds] as const,
  detail: (periodId: string) => ["payout-period", periodId] as const,
  jobs: (periodId: string) => ["payout-jobs", periodId] as const,
  adjustments: (periodId: string) => ["payout-adjustments", periodId] as const,
};

export function usePayoutPeriods(companyId: string | undefined) {
  return useQuery({
    queryKey: payoutKeys.list(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_periods")
        .select("*")
        .eq("company_id", companyId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(companyId),
  });
}

/** Acertos em que o profissional aparece — o RLS já limita ao próprio. */
export function useMyPayoutPeriods(memberIds: string[]) {
  return useQuery({
    queryKey: payoutKeys.mine(memberIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_periods")
        .select("*")
        .in("member_id", memberIds)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: memberIds.length > 0,
  });
}

export function usePayoutPeriod(periodId: string) {
  return useQuery({
    queryKey: payoutKeys.detail(periodId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_periods")
        .select("*")
        .eq("id", periodId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type NewPeriodInput = {
  companyId: string;
  memberId: string;
  startDate: string;
  endDate: string;
  payModel: PayModel;
  workerPercentage: number | null;
  dailyRate: number | null;
  hourlyRate: number | null;
};

export function useCreatePayoutPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewPeriodInput) => {
      const { data, error } = await supabase
        .from("payout_periods")
        .insert({
          company_id: input.companyId,
          member_id: input.memberId,
          start_date: input.startDate,
          end_date: input.endDate,
          pay_model: input.payModel,
          worker_percentage: input.workerPercentage,
          daily_rate: input.dailyRate,
          hourly_rate: input.hourlyRate,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payout-periods"] });
    },
  });
}

/**
 * Casas concluídas do profissional dentro do período.
 *
 * Só entram serviços concluídos: agendado ou cancelado não gera dinheiro, e
 * contar isso no acerto criaria dívida de trabalho que não aconteceu.
 */
export function usePeriodJobs(period: PayoutPeriod | null | undefined) {
  return useQuery({
    queryKey: payoutKeys.jobs(period?.id ?? "none"),
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from("appointment_assignments")
        .select("appointment_id")
        .eq("member_id", period!.member_id);
      if (error) throw error;

      const ids = assignments.map((assignment) => assignment.appointment_id);
      if (ids.length === 0) return [] as Appointment[];

      const { data, error: jobsError } = await supabase
        .from("appointments")
        .select("*")
        .in("id", ids)
        .eq("status", "completed")
        .gte("scheduled_date", period!.start_date)
        .lte("scheduled_date", period!.end_date)
        .order("scheduled_date");
      if (jobsError) throw jobsError;
      return data;
    },
    enabled: Boolean(period),
  });
}

export function useAdjustments(periodId: string) {
  return useQuery({
    queryKey: payoutKeys.adjustments(periodId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_adjustments")
        .select("*")
        .eq("period_id", periodId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddAdjustment(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ label, amount }: { label: string; amount: number }) => {
      const { error } = await supabase
        .from("payout_adjustments")
        .insert({ period_id: periodId, label, amount });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.adjustments(periodId) });
    },
  });
}

export function useRemoveAdjustment(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payout_adjustments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.adjustments(periodId) });
    },
  });
}

export function useUpdatePeriod(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<PayoutPeriod>) => {
      const { error } = await supabase.from("payout_periods").update(patch).eq("id", periodId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.detail(periodId) });
      void queryClient.invalidateQueries({ queryKey: ["payout-periods"] });
    },
  });
}

/**
 * Fecha o acerto guardando o resultado linha a linha. Depois disso, mudar o
 * preço de uma casa antiga não reescreve o que já foi combinado e pago.
 */
export function useClosePeriod(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobs,
      settlement,
      labels,
    }: {
      jobs: SettlementJob[];
      settlement: Settlement;
      labels: Map<string, string>;
    }) => {
      const { error: clearError } = await supabase
        .from("payout_lines")
        .delete()
        .eq("period_id", periodId);
      if (clearError) throw clearError;

      // A divisão de cada casa segue a proporção do período, para que a soma das
      // linhas bata exatamente com o total acertado.
      const share = settlement.splitBase > 0 ? settlement.workerDue / settlement.splitBase : 0;

      const lines = jobs.map((job) => {
        const workerShare = Math.round(job.price * share * 100) / 100;
        return {
          period_id: periodId,
          appointment_id: job.id,
          label: labels.get(job.id) ?? job.label,
          service_date: job.date,
          gross: job.price,
          collector: job.collector,
          worker_share: workerShare,
          company_share: Math.round((job.price - workerShare) * 100) / 100,
        };
      });

      if (lines.length > 0) {
        const { error } = await supabase.from("payout_lines").insert(lines);
        if (error) throw error;
      }

      const { error: statusError } = await supabase
        .from("payout_periods")
        .update({ status: "settled", settled_at: new Date().toISOString() })
        .eq("id", periodId);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.detail(periodId) });
      void queryClient.invalidateQueries({ queryKey: ["payout-periods"] });
    },
  });
}
