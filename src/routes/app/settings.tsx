import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SwitchRow } from "@/components/ui/switch";
import { useSession } from "@/features/auth/session";
import { useUpdateCompany } from "@/features/company/api";
import { supabase } from "@/integrations/supabase/client";
import type { Account, PayModel } from "@/integrations/supabase/types";
import { useI18n, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

const PAY_MODELS: PayModel[] = ["percentage", "daily", "hourly"];

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const { user, account, company, isManager, refresh, signOut } = useSession();
  const updateCompany = useUpdateCompany(company?.id);

  async function patchAccount(patch: Partial<Account>) {
    if (!user) return;
    const { error } = await supabase.from("accounts").update(patch).eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.account")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label={t("settings.fullName")}>
            <Input
              defaultValue={account?.full_name ?? ""}
              onBlur={(event) => patchAccount({ full_name: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.phone")}>
              <Input
                type="tel"
                defaultValue={account?.phone ?? ""}
                onBlur={(event) => patchAccount({ phone: event.target.value || null })}
              />
            </Field>
            <Field label={t("settings.city")}>
              <Input
                defaultValue={account?.city ?? ""}
                onBlur={(event) => patchAccount({ city: event.target.value || null })}
              />
            </Field>
          </div>
          <Field label={t("common.language")}>
            <Select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="pt">Português</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {company && isManager ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.company")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Field label={t("settings.companyName")}>
                <Input
                  defaultValue={company.name}
                  onBlur={(event) => updateCompany.mutate({ name: event.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("settings.city")}>
                  <Input
                    defaultValue={company.city ?? ""}
                    onBlur={(event) => updateCompany.mutate({ city: event.target.value || null })}
                  />
                </Field>
                <Field label={t("settings.state")}>
                  <Input
                    defaultValue={company.state ?? ""}
                    onBlur={(event) => updateCompany.mutate({ state: event.target.value || null })}
                  />
                </Field>
              </div>
              <Button asChild variant="outline">
                <Link to="/app/team">
                  <Users className="size-4" />
                  {t("team.title")}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.visibility")}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border py-0">
              <SwitchRow
                label={t("settings.showPricesToWorkers")}
                description={t("settings.showPricesToWorkersHelp")}
                checked={company.show_prices_to_workers}
                onCheckedChange={(checked) =>
                  updateCompany.mutate({ show_prices_to_workers: checked })
                }
              />
              <SwitchRow
                label={t("settings.showPricesToCustomers")}
                description={t("settings.showPricesToCustomersHelp")}
                checked={company.show_prices_to_customers}
                onCheckedChange={(checked) =>
                  updateCompany.mutate({ show_prices_to_customers: checked })
                }
              />
              <SwitchRow
                label={t("settings.allowCustomerChat")}
                description={t("settings.allowCustomerChatHelp")}
                checked={company.allow_customer_chat}
                onCheckedChange={(checked) =>
                  updateCompany.mutate({ allow_customer_chat: checked })
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.defaults")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Field label={t("team.payModel")}>
                <Select
                  value={company.default_pay_model}
                  onChange={(event) =>
                    updateCompany.mutate({ default_pay_model: event.target.value as PayModel })
                  }
                >
                  {PAY_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {t(`payModel.${model}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("settings.defaultSplit")} hint={t("settings.defaultSplitHelp")}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={company.default_worker_percentage}
                  onBlur={(event) =>
                    updateCompany.mutate({ default_worker_percentage: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label={t("team.dailyRate")}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={company.default_daily_rate ?? ""}
                  onBlur={(event) =>
                    updateCompany.mutate({
                      default_daily_rate: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </Field>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Button
        variant="outline"
        onClick={async () => {
          await signOut();
          await navigate({ to: "/" });
        }}
      >
        <LogOut className="size-4" />
        {t("nav.signOut")}
      </Button>
    </div>
  );
}
