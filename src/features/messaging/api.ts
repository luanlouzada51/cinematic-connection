import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Thread } from "@/integrations/supabase/types";

export const messageKeys = {
  threads: () => ["threads"] as const,
  thread: (threadId: string) => ["thread", threadId] as const,
  messages: (threadId: string) => ["messages", threadId] as const,
};

/** O RLS já devolve só as conversas de quem está pedindo. */
export function useThreads() {
  return useQuery({
    queryKey: messageKeys.threads(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useThread(threadId: string) {
  return useQuery({
    queryKey: messageKeys.thread(threadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .eq("id", threadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMessages(threadId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: messageKeys.messages(threadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("thread_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // A conversa acontece durante o serviço; esperar refetch manual não serve.
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: messageKeys.messages(threadId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return query;
}

/**
 * Nomes que aparecem na lista de conversas. Cada lado enxerga o outro: a
 * empresa vê o cliente ou o profissional, e eles veem a empresa.
 */
export function useThreadDirectory(threads: Thread[]) {
  const companyIds = unique(threads.map((thread) => thread.company_id));
  const customerIds = unique(threads.map((thread) => thread.customer_id));
  const workerIds = unique(threads.map((thread) => thread.worker_id));

  return useQuery({
    queryKey: ["thread-directory", companyIds, customerIds, workerIds],
    queryFn: async () => {
      const [companies, customers, accounts] = await Promise.all([
        companyIds.length
          ? supabase.from("companies").select("id, name").in("id", companyIds)
          : null,
        customerIds.length
          ? supabase.from("customers").select("id, name").in("id", customerIds)
          : null,
        workerIds.length
          ? supabase.from("accounts").select("id, full_name").in("id", workerIds)
          : null,
      ]);

      return {
        companyNames: new Map((companies?.data ?? []).map((row) => [row.id, row.name])),
        customerNames: new Map((customers?.data ?? []).map((row) => [row.id, row.name])),
        workerNames: new Map((accounts?.data ?? []).map((row) => [row.id, row.full_name])),
      };
    },
    enabled: threads.length > 0,
  });
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export function useSendMessage(threadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ body, senderId }: { body: string; senderId: string }) => {
      const { error } = await supabase
        .from("thread_messages")
        .insert({ thread_id: threadId, sender_id: senderId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.messages(threadId) });
      void queryClient.invalidateQueries({ queryKey: messageKeys.threads() });
    },
  });
}

type CustomerThreadInput = { companyId: string; customerId: string };
type GigThreadInput = { companyId: string; gigId: string; workerId: string };

/**
 * Conversa é criada sob demanda: só existe quando alguém tem algo a dizer.
 * Como o par (empresa, cliente) e (vaga, profissional) é único no banco, o
 * upsert evita duas conversas para a mesma dupla.
 */
export function useEnsureThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CustomerThreadInput | GigThreadInput): Promise<Thread> => {
      const isCustomer = "customerId" in input;

      const existing = isCustomer
        ? await supabase
            .from("threads")
            .select("*")
            .eq("kind", "customer")
            .eq("company_id", input.companyId)
            .eq("customer_id", input.customerId)
            .maybeSingle()
        : await supabase
            .from("threads")
            .select("*")
            .eq("kind", "gig")
            .eq("gig_id", input.gigId)
            .eq("worker_id", input.workerId)
            .maybeSingle();

      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;

      const { data, error } = await supabase
        .from("threads")
        .insert(
          isCustomer
            ? { kind: "customer", company_id: input.companyId, customer_id: input.customerId }
            : {
                kind: "gig",
                company_id: input.companyId,
                gig_id: input.gigId,
                worker_id: input.workerId,
              },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.threads() });
    },
  });
}
