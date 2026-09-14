import type {
  MemberRole,
  PayModel,
  PaymentCollector,
  ServiceType,
} from "@/integrations/supabase/types";

/**
 * Ordem em que os valores de cada enum aparecem nos formulários.
 *
 * O banco não tem ordem; a tela tem. Manter a lista em um lugar só evita que
 * uma opção nova exista em uma tela e falte em outra.
 */

export const SERVICE_TYPES: ServiceType[] = [
  "standard",
  "deep_clean",
  "move_in_out",
  "post_construction",
  "office",
];

export const COLLECTORS: PaymentCollector[] = ["unpaid", "company", "worker"];

export const PAY_MODELS: PayModel[] = ["percentage", "daily", "hourly"];

export const MEMBER_ROLES: MemberRole[] = ["cleaner", "manager", "owner"];
