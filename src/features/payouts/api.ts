import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  Appointment,
  Gig,
  GigWorker,
  PayModel,
  PayoutPeriod,
} from "@/integrations/supabase/types";
import { gigEarning, round2 } from "@/features/payouts/settlement";
import type { Settlement, SettlementGig, SettlementJob } from "@/features/payouts/settlement";

export const payoutKeys = {
  list: (companyId: string | undefined) => ["payout-periods", companyId] as const,
  mine: (memberIds: string[], accountId: string | undefined) =>
    ["payout-periods-mine", memberIds, accountId] as const,
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

/**
 * Acertos da pessoa que está olhando — como membro de equipe ou como
 * profissional contratado pelo mercado. O RLS já limita ao próprio.
 */
export function useMyPayoutPeriods(memberIds: string[], accountId: string | undefined) {
  return useQuery({
    queryKey: payoutKeys.mine(memberIds, accountId),
    queryFn: async () => {
      const filters = [
        ...(memberIds.length > 0 ? [`member_id.in.(${memberIds.join(",")})`] : []),
        `worker_account_id.eq.${accountId}`,
      ];

      const { data, error } = await supabase
        .from("payout_periods")
        .select("*")
        .or(filters.join(","))
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(accountId),
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
  /** Exatamente um dos dois: alguém da equipe ou alguém vindo do mercado. */
  memberId: string | null;
  workerAccountId: string | null;
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
          worker_account_id: input.workerAccountId,
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
      // Quem veio do mercado não tem vínculo de equipe, então não aparece em
      // nenhuma casa da agenda: o acerto dele é só das vagas.
      if (!period?.member_id) return [] as Appointment[];

      const { data: assignments, error } = await supabase
        .from("appointment_assignments")
        .select("appointment_id")
        .eq("member_id", period.member_id);
      if (error) throw error;

      const ids = assignments.map((assignment) => assignment.appointment_id);
      if (ids.length === 0) return [] as Appointment[];

      const { data, error: jobsError } = await supabase
        .from("appointments")
        .select("*")
        .in("id", ids)
        .eq("status", "completed")
        .gte("scheduled_date", period.start_date)
        .lte("scheduled_date", period.end_date)
        .order("scheduled_date");
      if (jobsError) throw jobsError;
      return data;
    },
    enabled: Boolean(period),
  });
}

/**
 * Trabalhos do mercado concluídos pela pessoa dentro do período, já com a vaga
 * ao lado — é dela que saem as condições combinadas e a data.
 */
export function usePeriodGigs(
  period: PayoutPeriod | null | undefined,
  accountId: string | undefined,
) {
  return useQuery({
    queryKey: ["payout-gigs", period?.id, accountId],
    queryFn: async (): Promise<PeriodGig[]> => {
      const { data: bonds, error } = await supabase
        .from("gig_workers")
        .select("*")
        .eq("worker_id", accountId!)
        .eq("status", "completed");
      if (error) throw error;
      if (bonds.length === 0) return [];

      const { data: gigs, error: gigsError } = await supabase
        .from("gigs")
        .select("*")
        .in(
          "id",
          bonds.map((bond) => bond.gig_id),
        )
        .eq("company_id", period!.company_id)
        .gte("date", period!.start_date)
        .lte("date", period!.end_date)
        .order("date");
      if (gigsError) throw gigsError;

      const bondByGig = new Map(bonds.map((bond) => [bond.gig_id, bond]));
      return gigs
        .map((gig) => ({ gig, bond: bondByGig.get(gig.id)! }))
        .filter((row) => row.bond != null);
    },
    enabled: Boolean(period && accountId),
  });
}

export type PeriodGig = { gig: Gig; bond: GigWorker };

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
      gigs,
      settlement,
    }: {
      jobs: SettlementJob[];
      gigs: SettlementGig[];
      settlement: Settlement;
    }) => {
      const { error: clearError } = await supabase
        .from("payout_lines")
        .delete()
        .eq("period_id", periodId);
      if (clearError) throw clearError;

      // As casas da agenda dividem a parte do profissional que veio delas, na
      // proporção do preço de cada uma — assim a soma das linhas bate com o
      // total acertado, sem sobra de centavo.
      const housesDue = round2(settlement.workerDue - settlement.gigsBase);
      const share = settlement.splitBase > 0 ? housesDue / settlement.splitBase : 0;

      const houseLines = jobs.map((job) => {
        const workerShare = round2(job.price * share);
        return {
          period_id: periodId,
          appointment_id: job.id,
          label: job.label,
          service_date: job.date,
          gross: job.price,
          collector: job.collector,
          worker_share: workerShare,
          company_share: round2(job.price - workerShare),
        };
      });

      // Cada vaga já tem o próprio combinado, então a linha guarda o valor exato.
      const gigLines = gigs.map((gig) => {
        const workerShare = round2(gigEarning(gig));
        return {
          period_id: periodId,
          gig_id: gig.id,
          label: gig.label,
          service_date: gig.date,
          gross: gig.revenue,
          collector: gig.collector,
          worker_share: workerShare,
          company_share: round2(gig.revenue - workerShare),
        };
      });

      const lines = [...houseLines, ...gigLines];

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
