import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Home, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useSession } from "@/features/auth/session";
import { supabase } from "@/integrations/supabase/client";
import type { AccountRole } from "@/integrations/supabase/types";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/onboarding")({ component: Onboarding });

const ROLES: Array<{
  role: AccountRole;
  icon: LucideIcon;
  title: TranslationKey;
  description: TranslationKey;
}> = [
  {
    role: "owner",
    icon: Building2,
    title: "onboarding.roleOwner",
    description: "onboarding.roleOwnerDesc",
  },
  {
    role: "worker",
    icon: Sparkles,
    title: "onboarding.roleWorker",
    description: "onboarding.roleWorkerDesc",
  },
  {
    role: "customer",
    icon: Home,
    title: "onboarding.roleCustomer",
    description: "onboarding.roleCustomerDesc",
  },
];

function Onboarding() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user, account, refresh } = useSession();

  const [role, setRole] = useState<AccountRole>(account?.primary_role ?? "owner");
  const [fullName, setFullName] = useState(account?.full_name ?? "");
  const [companyName, setCompanyName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFinish(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);

    try {
      await setupRole({ userId: user.id, role, fullName, companyName, code });
      await supabase
        .from("accounts")
        .update({ full_name: fullName, primary_role: role, locale, onboarding_done: true })
        .eq("id", user.id);
      await refresh();
      await navigate({ to: "/app", replace: true });
    } catch (error) {
      toast.error(
        error instanceof CodeNotFoundError
          ? t("onboarding.codeInvalid")
          : error instanceof Error
            ? error.message
            : t("error.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-6 py-4" onSubmit={handleFinish}>
      <header>
        <h1 className="text-2xl font-semibold">{t("onboarding.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-2">
        {ROLES.map((option) => (
          <button
            key={option.role}
            type="button"
            onClick={() => setRole(option.role)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              role === option.role
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <option.icon className="mt-0.5 size-5 text-primary" />
            <span>
              <span className="block text-sm font-medium">{t(option.title)}</span>
              <span className="block text-sm text-muted-foreground">{t(option.description)}</span>
            </span>
          </button>
        ))}
      </div>

      <Field label={t("auth.name")}>
        <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </Field>

      {role === "owner" ? (
        <Field label={t("onboarding.companyName")}>
          <Input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            required
          />
        </Field>
      ) : null}

      {role === "worker" ? (
        <Field label={t("onboarding.inviteCode")} hint={t("onboarding.inviteCodeHelp")}>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </Field>
      ) : null}

      {role === "customer" ? (
        <Field label={t("onboarding.portalCode")} hint={t("onboarding.portalCodeHelp")}>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            required
          />
        </Field>
      ) : null}

      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? t("common.saving") : t("onboarding.finish")}
      </Button>
    </form>
  );
}

class CodeNotFoundError extends Error {}

type SetupInput = {
  userId: string;
  role: AccountRole;
  fullName: string;
  companyName: string;
  code: string;
};

/** Cada papel precisa de um cadastro diferente para o app fazer sentido depois. */
async function setupRole({ userId, role, fullName, companyName, code }: SetupInput) {
  if (role === "owner") {
    const { data: company, error } = await supabase
      .from("companies")
      .insert({ owner_id: userId, name: companyName })
      .select()
      .single();
    if (error) throw error;

    const { error: memberError } = await supabase.from("company_members").insert({
      company_id: company.id,
      account_id: userId,
      display_name: fullName || companyName,
      role: "owner",
    });
    if (memberError) throw memberError;
    return;
  }

  if (role === "worker") {
    const { error } = await supabase
      .from("worker_profiles")
      .upsert({ account_id: userId }, { onConflict: "account_id" });
    if (error) throw error;

    if (code.trim()) {
      const { data, error: claimError } = await supabase.rpc("claim_team_invite", { _code: code });
      if (claimError) throw claimError;
      if (!data) throw new CodeNotFoundError();
    }
    return;
  }

  const { data, error } = await supabase.rpc("claim_customer_portal", { _code: code });
  if (error) throw error;
  if (!data) throw new CodeNotFoundError();
}
