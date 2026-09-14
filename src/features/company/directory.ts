import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CompanyMember, Customer, Property } from "@/integrations/supabase/types";

/**
 * Cadastro básico da empresa — clientes, casas e equipe — carregado uma vez e
 * reaproveitado por todas as telas.
 *
 * A alternativa seria pedir joins aninhados em cada consulta; assim a agenda, o
 * acerto e o chat leem os mesmos dados já em memória, e cada tela junta o que
 * precisa sem repetir round-trip.
 */
export type Directory = {
  customers: Customer[];
  properties: Property[];
  members: CompanyMember[];
  customerById: Map<string, Customer>;
  propertyById: Map<string, Property>;
  memberById: Map<string, CompanyMember>;
  propertiesByCustomer: Map<string, Property[]>;
};

export const directoryKey = (companyId: string | undefined) => ["directory", companyId] as const;

function index<T>(rows: T[], pick: (row: T) => string): Map<string, T> {
  return new Map(rows.map((row) => [pick(row), row]));
}

function groupBy<T>(rows: T[], pick: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = pick(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

async function loadDirectory(companyId: string): Promise<Directory> {
  const [customersResult, propertiesResult, membersResult] = await Promise.all([
    supabase.from("customers").select("*").eq("company_id", companyId).order("name"),
    supabase.from("properties").select("*").order("label"),
    supabase.from("company_members").select("*").eq("company_id", companyId).order("display_name"),
  ]);

  if (customersResult.error) throw customersResult.error;
  if (propertiesResult.error) throw propertiesResult.error;
  if (membersResult.error) throw membersResult.error;

  const customers = customersResult.data;
  const customerIds = new Set(customers.map((customer) => customer.id));
  // O RLS já limita as casas às da empresa; o filtro aqui protege o caso de
  // alguém pertencer a mais de uma companhia.
  const properties = propertiesResult.data.filter((property) =>
    customerIds.has(property.customer_id),
  );

  return {
    customers,
    properties,
    members: membersResult.data,
    customerById: index(customers, (customer) => customer.id),
    propertyById: index(properties, (property) => property.id),
    memberById: index(membersResult.data, (member) => member.id),
    propertiesByCustomer: groupBy(properties, (property) => property.customer_id),
  };
}

export function useDirectory(companyId: string | undefined) {
  return useQuery({
    queryKey: directoryKey(companyId),
    queryFn: () => loadDirectory(companyId!),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
}
