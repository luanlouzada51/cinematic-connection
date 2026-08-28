import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/integrations/supabase/types";

export const companyKeys = {
  detail: (companyId: string | undefined) => ["company", companyId] as const,
};

export function useCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: companyKeys.detail(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(companyId),
  });
}

export function useUpdateCompany(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Company>) => {
      const { error } = await supabase.from("companies").update(patch).eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.detail(companyId) });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}
