import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  ApplicationStatus,
  AvailabilityPeriod,
  CleaningSkill,
  Gig,
  GigWorker,
  PayModel,
  ReviewSubject,
  WorkerProfile,
} from "@/integrations/supabase/types";

export const marketKeys = {
  profile: (accountId: string | undefined) => ["worker-profile", accountId] as const,
  availability: (accountId: string | undefined) => ["worker-availability", accountId] as const,
  workerSearch: (date: string, city: string, skills: CleaningSkill[]) =>
    ["worker-search", date, city, skills] as const,
  gigs: (city: string, date: string, skills: CleaningSkill[]) =>
    ["gigs", city, date, skills] as const,
  companyGigs: (companyId: string | undefined) => ["company-gigs", companyId] as const,
  gig: (gigId: string) => ["gig", gigId] as const,
  applications: (gigId: string) => ["gig-applications", gigId] as const,
  myApplications: (workerId: string | undefined) => ["my-applications", workerId] as const,
  gigWorkers: (gigId: string) => ["gig-workers", gigId] as const,
  reviewsForWorker: (accountId: string) => ["reviews-worker", accountId] as const,
  reviewsForGig: (gigId: string) => ["reviews-gig", gigId] as const,
};

// ---------------------------------------------------------------------------
// Perfil profissional
// ---------------------------------------------------------------------------
export function useWorkerProfile(accountId: string | undefined) {
  return useQuery({
    queryKey: marketKeys.profile(accountId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(accountId),
  });
}

export function useSaveWorkerProfile(accountId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<WorkerProfile>) => {
      const { error } = await supabase
        .from("worker_profiles")
        .upsert({ account_id: accountId!, ...patch }, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.profile(accountId) });
    },
  });
}

export function useAvailability(accountId: string | undefined) {
  return useQuery({
    queryKey: marketKeys.availability(accountId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_availability")
        .select("*")
        .eq("account_id", accountId!)
        .order("date");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(accountId),
  });
}

export function useSetAvailability(accountId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, period }: { date: string; period: AvailabilityPeriod }) => {
      const { error } = await supabase
        .from("worker_availability")
        .upsert({ account_id: accountId!, date, period }, { onConflict: "account_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.availability(accountId) });
    },
  });
}

export function useRemoveAvailability(accountId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("worker_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.availability(accountId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Busca de profissionais
// ---------------------------------------------------------------------------
export type WorkerSearchFilters = { date: string; city: string; skills: CleaningSkill[] };

export function useWorkerSearch({ date, city, skills }: WorkerSearchFilters) {
  return useQuery({
    queryKey: marketKeys.workerSearch(date, city, skills),
    queryFn: async () => {
      // Com data escolhida, a busca parte de quem marcou aquele dia como livre.
      let availableIds: string[] | null = null;
      if (date) {
        const { data, error } = await supabase
          .from("worker_availability")
          .select("account_id")
          .eq("date", date);
        if (error) throw error;
        availableIds = data.map((row) => row.account_id);
        if (availableIds.length === 0) return [];
      }

      let query = supabase.from("worker_profiles").select("*").eq("visible", true);
      if (availableIds) query = query.in("account_id", availableIds);
      if (skills.length > 0) query = query.contains("skills", skills);

      const { data: profiles, error } = await query.order("rating_avg", { ascending: false });
      if (error) throw error;

      const accountIds = profiles.map((profile) => profile.account_id);
      if (accountIds.length === 0) return [];

      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id, full_name, avatar_url, city, state")
        .in("id", accountIds);
      if (accountsError) throw accountsError;

      const byId = new Map(accounts.map((account) => [account.id, account]));
      const needle = city.trim().toLowerCase();

      return profiles
        .map((profile) => ({ profile, account: byId.get(profile.account_id) }))
        .filter((row) => row.account != null)
        .filter((row) => !needle || (row.account?.city ?? "").toLowerCase().includes(needle));
    },
  });
}

// ---------------------------------------------------------------------------
// Vagas
// ---------------------------------------------------------------------------
export function useOpenGigs({
  city,
  date,
  skills,
}: {
  city: string;
  date: string;
  skills: CleaningSkill[];
}) {
  return useQuery({
    queryKey: marketKeys.gigs(city, date, skills),
    queryFn: async () => {
      let query = supabase.from("gigs").select("*").in("status", ["open", "filled"]);
      if (date) query = query.eq("date", date);
      if (skills.length > 0) query = query.overlaps("required_skills", skills);
      if (city.trim()) query = query.ilike("city", `%${city.trim()}%`);

      const { data, error } = await query.order("date").limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/** Vagas específicas — usado para montar a lista de candidaturas do profissional. */
export function useGigsByIds(gigIds: string[]) {
  const key = [...new Set(gigIds)].sort();

  return useQuery({
    queryKey: ["gigs-by-id", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gigs")
        .select("*")
        .in("id", key)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: key.length > 0,
  });
}

export function useCompanyGigs(companyId: string | undefined) {
  return useQuery({
    queryKey: marketKeys.companyGigs(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gigs")
        .select("*")
        .eq("company_id", companyId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(companyId),
  });
}

export function useGig(gigId: string) {
  return useQuery({
    queryKey: marketKeys.gig(gigId),
    queryFn: async () => {
      const { data, error } = await supabase.from("gigs").select("*").eq("id", gigId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type NewGigInput = {
  companyId: string;
  createdBy: string;
  title: string;
  description: string;
  city: string;
  state: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredSkills: CleaningSkill[];
  headcount: number;
  payModel: PayModel;
  dailyRate: number | null;
  hourlyRate: number | null;
  workerPercentage: number | null;
};

export function useCreateGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewGigInput) => {
      const { data, error } = await supabase
        .from("gigs")
        .insert({
          company_id: input.companyId,
          created_by: input.createdBy,
          title: input.title,
          description: input.description || null,
          city: input.city || null,
          state: input.state || null,
          date: input.date,
          start_time: input.startTime,
          end_time: input.endTime || null,
          required_skills: input.requiredSkills,
          headcount: input.headcount,
          pay_model: input.payModel,
          daily_rate: input.dailyRate,
          hourly_rate: input.hourlyRate,
          worker_percentage: input.workerPercentage,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gigs"] });
      void queryClient.invalidateQueries({ queryKey: ["company-gigs"] });
    },
  });
}

export function useUpdateGig(gigId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Gig>) => {
      const { error } = await supabase.from("gigs").update(patch).eq("id", gigId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.gig(gigId) });
      void queryClient.invalidateQueries({ queryKey: ["company-gigs"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Candidaturas e vínculo
// ---------------------------------------------------------------------------
export function useApplications(gigId: string) {
  return useQuery({
    queryKey: marketKeys.applications(gigId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gig_applications")
        .select("*")
        .eq("gig_id", gigId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useMyApplications(workerId: string | undefined) {
  return useQuery({
    queryKey: marketKeys.myApplications(workerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gig_applications")
        .select("*")
        .eq("worker_id", workerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(workerId),
  });
}

export function useApplyToGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gigId,
      workerId,
      message,
    }: {
      gigId: string;
      workerId: string;
      message: string;
    }) => {
      const { error } = await supabase
        .from("gig_applications")
        .insert({ gig_id: gigId, worker_id: workerId, message: message || null });
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.applications(variables.gigId) });
      void queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

export function useUpdateApplication(gigId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicationStatus }) => {
      const { error } = await supabase.from("gig_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.applications(gigId) });
      void queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

export function useGigWorkers(gigId: string) {
  return useQuery({
    queryKey: marketKeys.gigWorkers(gigId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gig_workers")
        .select("*")
        .eq("gig_id", gigId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Contratar cria o vínculo que dura até o fim do serviço — as condições de
 * pagamento são copiadas da vaga para que uma edição posterior não mude o que
 * já foi combinado.
 */
export function useHireWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workerId, gig }: { workerId: string; gig: Gig }) => {
      const { error } = await supabase.from("gig_workers").insert({
        gig_id: gig.id,
        worker_id: workerId,
        agreed_pay_model: gig.pay_model,
        agreed_daily_rate: gig.daily_rate,
        agreed_hourly_rate: gig.hourly_rate,
        agreed_percentage: gig.worker_percentage,
      });
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.gigWorkers(variables.gig.id) });
      void queryClient.invalidateQueries({ queryKey: marketKeys.gig(variables.gig.id) });
    },
  });
}

export function useUpdateGigWorker(gigId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<GigWorker> }) => {
      // Mudar de estado carimba a hora sozinho: é o registro do vínculo.
      const stamps =
        patch.status === "in_progress"
          ? { started_at: new Date().toISOString() }
          : patch.status === "completed"
            ? { ended_at: new Date().toISOString() }
            : {};

      const { error } = await supabase
        .from("gig_workers")
        .update({ ...patch, ...stamps })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.gigWorkers(gigId) });
      void queryClient.invalidateQueries({ queryKey: marketKeys.gig(gigId) });
      void queryClient.invalidateQueries({ queryKey: ["payout-gigs"] });
    },
  });
}

/**
 * Quem trabalhou para a empresa vindo do mercado, sem estar na equipe.
 * É essa lista que permite gerar um acerto para um contratado de fora.
 */
export function useMarketWorkers(companyId: string | undefined) {
  return useQuery({
    queryKey: ["market-workers", companyId],
    queryFn: async () => {
      const { data: gigs, error } = await supabase
        .from("gigs")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      if (gigs.length === 0) return [];

      const { data: bonds, error: bondsError } = await supabase
        .from("gig_workers")
        .select("*")
        .in(
          "gig_id",
          gigs.map((gig) => gig.id),
        )
        .eq("status", "completed");
      if (bondsError) throw bondsError;

      const workerIds = [...new Set(bonds.map((bond) => bond.worker_id))];
      if (workerIds.length === 0) return [];

      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id, full_name")
        .in("id", workerIds);
      if (accountsError) throw accountsError;

      return accounts;
    },
    enabled: Boolean(companyId),
  });
}

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------
export function useGigReviews(gigId: string) {
  return useQuery({
    queryKey: marketKeys.reviewsForGig(gigId),
    queryFn: async () => {
      const { data, error } = await supabase.from("work_reviews").select("*").eq("gig_id", gigId);
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkerReviews(accountId: string) {
  return useQuery({
    queryKey: marketKeys.reviewsForWorker(accountId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_reviews")
        .select("*")
        .eq("subject_account_id", accountId)
        .eq("subject_kind", "worker")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSubmitReview(gigId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      authorId: string;
      subjectKind: ReviewSubject;
      subjectAccountId?: string | undefined;
      subjectCompanyId?: string | undefined;
      rating: number;
      comment: string;
    }) => {
      const { error } = await supabase.from("work_reviews").insert({
        gig_id: gigId,
        author_id: input.authorId,
        subject_kind: input.subjectKind,
        subject_account_id: input.subjectAccountId ?? null,
        subject_company_id: input.subjectCompanyId ?? null,
        rating: input.rating,
        comment: input.comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketKeys.reviewsForGig(gigId) });
      void queryClient.invalidateQueries({ queryKey: ["reviews-worker"] });
    },
  });
}

/** Nomes e notas de um conjunto de profissionais, para listas e candidaturas. */
export function useWorkerCards(accountIds: string[]) {
  const key = [...new Set(accountIds)].sort();

  return useQuery({
    queryKey: ["worker-cards", key],
    queryFn: async () => {
      const [accounts, profiles] = await Promise.all([
        supabase.from("accounts").select("id, full_name, avatar_url, city, state").in("id", key),
        supabase.from("worker_profiles").select("*").in("account_id", key),
      ]);
      if (accounts.error) throw accounts.error;
      if (profiles.error) throw profiles.error;

      return {
        accounts: new Map(accounts.data.map((account) => [account.id, account])),
        profiles: new Map(profiles.data.map((profile) => [profile.account_id, profile])),
      };
    },
    enabled: key.length > 0,
  });
}
