import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { consumeOAuthRedirect } from "@/lib/oauthCallback";
import type { Account, Company, CompanyMember, Customer } from "@/integrations/supabase/types";

export type SessionState = {
  loading: boolean;
  user: User | null;
  account: Account | null;
  /** Empresa em que a pessoa trabalha (dono ou equipe). */
  company: Company | null;
  member: CompanyMember | null;
  /** Cadastros de cliente ligados a esta conta, quando ela acompanha visitas. */
  customerLinks: Customer[];
  isManager: boolean;
  /** Regra de visibilidade de preço, já resolvida para quem está olhando. */
  canSeePrices: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

type Workspace = {
  account: Account | null;
  company: Company | null;
  member: CompanyMember | null;
  customerLinks: Customer[];
};

const EMPTY_WORKSPACE: Workspace = {
  account: null,
  company: null,
  member: null,
  customerLinks: [],
};

async function loadWorkspace(userId: string): Promise<Workspace> {
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!account) return EMPTY_WORKSPACE;

  if (account.primary_role === "customer") {
    const { data: customerLinks } = await supabase
      .from("customers")
      .select("*")
      .eq("account_id", userId);
    return { ...EMPTY_WORKSPACE, account, customerLinks: customerLinks ?? [] };
  }

  const { data: member } = await supabase
    .from("company_members")
    .select("*")
    .eq("account_id", userId)
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  // O dono pode ter criado a empresa antes de existir a linha de equipe.
  const companyId = member?.company_id;
  const companyQuery = companyId
    ? supabase.from("companies").select("*").eq("id", companyId)
    : supabase.from("companies").select("*").eq("owner_id", userId);

  const { data: companies } = await companyQuery.limit(1);

  return {
    account,
    company: companies?.[0] ?? null,
    member: member ?? null,
    customerLinks: [],
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    });

    void (async () => {
      await consumeOAuthRedirect();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    })();

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const workspace = useQuery({
    queryKey: ["workspace", userId],
    queryFn: () => loadWorkspace(userId!),
    enabled: Boolean(userId),
  });

  const value = useMemo<SessionState>(() => {
    const data = workspace.data ?? EMPTY_WORKSPACE;
    const isManager =
      data.member?.role === "owner" ||
      data.member?.role === "manager" ||
      (data.company != null && data.company.owner_id === userId);

    return {
      loading: !authReady || (Boolean(userId) && workspace.isLoading),
      user: session?.user ?? null,
      account: data.account,
      company: data.company,
      member: data.member,
      customerLinks: data.customerLinks,
      isManager,
      canSeePrices: isManager || (data.company?.show_prices_to_workers ?? true),
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      },
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    };
  }, [authReady, queryClient, session, userId, workspace.data, workspace.isLoading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return value;
}
