import { useMutation, useQueryClient } from "@tanstack/react-query";

import { directoryKey } from "@/features/company/directory";
import { supabase } from "@/integrations/supabase/client";
import type { CompanyMember, MemberRole } from "@/integrations/supabase/types";
import { generateCode } from "@/lib/codes";

export function useInviteMember(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { displayName: string; email: string; role: MemberRole }) => {
      const { data, error } = await supabase
        .from("company_members")
        .insert({
          company_id: companyId!,
          display_name: input.displayName,
          invite_email: input.email || null,
          invite_code: generateCode(),
          role: input.role,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: directoryKey(companyId) });
    },
  });
}

export function useUpdateMember(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CompanyMember> }) => {
      const { error } = await supabase.from("company_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: directoryKey(companyId) });
    },
  });
}
