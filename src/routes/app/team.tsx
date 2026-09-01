import { createFileRoute } from "@tanstack/react-router";
import { Copy, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { useInviteMember, useUpdateMember } from "@/features/team/api";
import type { CompanyMember, MemberRole, PayModel } from "@/integrations/supabase/types";
import { MEMBER_ROLES, PAY_MODELS } from "@/lib/enums";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/team")({ component: TeamPage });

function TeamPage() {
  const { t } = useI18n();
  const { company, isManager } = useSession();
  const directory = useDirectory(company?.id);
  const invite = useInviteMember(company?.id);
  const updateMember = useUpdateMember(company?.id);

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("cleaner");

  if (!company) return <EmptyState icon={Users} title={t("error.noCompany")} />;
  if (!isManager) return <EmptyState title={t("error.notAllowed")} />;

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const member = await invite.mutateAsync({ displayName, email, role });
    setDisplayName("");
    setEmail("");
    setOpen(false);
    toast.success(`${t("team.inviteCreated")}: ${member.invite_code}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("team.title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              {t("team.invite")}
            </Button>
          </DialogTrigger>
          <DialogContent title={t("team.invite")} description={t("team.inviteCodeHelp")}>
            <form className="flex flex-col gap-3" onSubmit={handleInvite}>
              <Field label={t("team.displayName")}>
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </Field>
              <Field label={t("customers.email")}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label={t("team.role")}>
                <Select
                  value={role}
                  onChange={(event) => setRole(event.target.value as MemberRole)}
                >
                  {MEMBER_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {t(`role.${option}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" block disabled={invite.isPending}>
                {t("common.save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {directory.isLoading ? (
        <LoadingBlock />
      ) : (directory.data?.members.length ?? 0) === 0 ? (
        <EmptyState icon={Users} title={t("team.empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {directory.data?.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              defaultPercentage={company.default_worker_percentage}
              onPatch={(patch) => updateMember.mutate({ id: member.id, patch })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type MemberCardProps = {
  member: CompanyMember;
  defaultPercentage: number;
  onPatch: (patch: Partial<CompanyMember>) => void;
};

function MemberCard({ member, defaultPercentage, onPatch }: MemberCardProps) {
  const { t } = useI18n();
  const payModel = member.pay_model ?? "percentage";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{member.display_name}</p>
            <p className="text-xs text-muted-foreground">{t(`role.${member.role}`)}</p>
          </div>
          <div className="flex items-center gap-2">
            {member.account_id ? null : <Badge tone="warning">{t("team.pendingInvite")}</Badge>}
            {member.active ? null : <Badge tone="neutral">{t("common.inactive")}</Badge>}
          </div>
        </div>

        {member.invite_code && !member.account_id ? (
          <div className="flex items-center gap-2">
            <code className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold tracking-widest">
              {member.invite_code}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await navigator.clipboard.writeText(member.invite_code ?? "");
                toast.success(t("common.copied"));
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Field label={t("team.payModel")}>
            <Select
              value={payModel}
              onChange={(event) => onPatch({ pay_model: event.target.value as PayModel })}
            >
              {PAY_MODELS.map((option) => (
                <option key={option} value={option}>
                  {t(`payModel.${option}`)}
                </option>
              ))}
            </Select>
          </Field>

          {payModel === "percentage" ? (
            <Field label={t("team.percentage")} hint={t("team.usesCompanyDefault")}>
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={member.worker_percentage ?? defaultPercentage}
                onBlur={(event) => onPatch({ worker_percentage: Number(event.target.value) })}
              />
            </Field>
          ) : payModel === "daily" ? (
            <Field label={t("team.dailyRate")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={member.daily_rate ?? ""}
                onBlur={(event) => onPatch({ daily_rate: Number(event.target.value) })}
              />
            </Field>
          ) : (
            <Field label={t("team.hourlyRate")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={member.hourly_rate ?? ""}
                onBlur={(event) => onPatch({ hourly_rate: Number(event.target.value) })}
              />
            </Field>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onPatch({ active: !member.active })}
        >
          {member.active ? t("team.deactivate") : t("team.activate")}
        </Button>
      </CardContent>
    </Card>
  );
}
