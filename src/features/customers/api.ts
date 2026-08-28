import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { directoryKey } from "@/features/company/directory";
import { supabase } from "@/integrations/supabase/client";
import type { Customer, Property } from "@/integrations/supabase/types";
import { generateCode } from "@/lib/codes";

export const customerKeys = {
  detail: (customerId: string) => ["customer", customerId] as const,
  series: (customerId: string) => ["customer-series", customerId] as const,
};

function useDirectoryInvalidation(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: directoryKey(companyId) });
}

export function useCreateCustomer(companyId: string | undefined) {
  const invalidate = useDirectoryInvalidation(companyId);

  return useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      phone: string;
      notes: string;
      property: Omit<Property, "id" | "customer_id" | "created_at">;
    }) => {
      const { data: customer, error } = await supabase
        .from("customers")
        .insert({
          company_id: companyId!,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          notes: input.notes || null,
          // Código curto que o cliente usa para acompanhar as visitas pelo app.
          portal_code: generateCode(),
        })
        .select()
        .single();
      if (error) throw error;

      const { error: propertyError } = await supabase
        .from("properties")
        .insert({ ...input.property, customer_id: customer.id });
      if (propertyError) throw propertyError;

      return customer;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateCustomer(companyId: string | undefined) {
  const invalidate = useDirectoryInvalidation(companyId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Customer> }) => {
      const { error } = await supabase.from("customers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCustomer(companyId: string | undefined) {
  const invalidate = useDirectoryInvalidation(companyId);

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useSaveProperty(companyId: string | undefined) {
  const invalidate = useDirectoryInvalidation(companyId);

  return useMutation({
    mutationFn: async (
      property: Partial<Property> & { customer_id: string; address_line1: string },
    ) => {
      if (property.id) {
        const { error } = await supabase.from("properties").update(property).eq("id", property.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("properties").insert(property);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteProperty(companyId: string | undefined) {
  const invalidate = useDirectoryInvalidation(companyId);

  return useMutation({
    mutationFn: async (propertyId: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });
}

/** Contratos recorrentes do cliente (o que gera as visitas da agenda). */
export function useCustomerSeries(customerId: string) {
  return useQuery({
    queryKey: customerKeys.series(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_series")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
