import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Home, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useCompany } from "@/features/company/api";
import { useEnsureThread } from "@/features/messaging/api";
import { AppointmentCard } from "@/features/schedule/components";
import { useJobPlace } from "@/features/schedule/api";
import { supabase } from "@/integrations/supabase/client";
import type { Appointment } from "@/integrations/supabase/types";
import { formatAddress, toDateOnly } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/visits")({ component: VisitsPage });

type Tab = "upcoming" | "past";

function VisitsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { customerLinks, refresh } = useSession();
  const ensureThread = useEnsureThread();

  const [tab, setTab] = useState<Tab>("upcoming");
  const [code, setCode] = useState("");

  const customerIds = customerLinks.map((customer) => customer.id);
  const today = toDateOnly(new Date());

  const visits = useQuery({
    queryKey: ["visits", customerIds.join(","), tab],
    queryFn: async () => {
      const query = supabase.from("appointments").select("*").in("customer_id", customerIds);
      const { data, error } =
        tab === "upcoming"
          ? await query.gte("scheduled_date", today).order("scheduled_date").order("start_time")
          : await query
              .lt("scheduled_date", today)
              .order("scheduled_date", { ascending: false })
              .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: customerIds.length > 0,
  });

  const next = visits.data?.[0];
  const nextPlace = useJobPlace(next?.customer_id, next?.property_id);

  async function handleLink(event: React.FormEvent) {
    event.preventDefault();
    const { data, error } = await supabase.rpc("claim_customer_portal", { _code: code });
    if (error || !data) {
      toast.error(t("onboarding.codeInvalid"));
      return;
    }
    setCode("");
    await refresh();
    toast.success(t("onboarding.codeLinked"));
  }

  async function handleChat() {
    const link = customerLinks[0];
    if (!link) return;
    const thread = await ensureThread.mutateAsync({
      companyId: link.company_id,
      customerId: link.id,
    });
    await navigate({ to: "/app/messages/$threadId", params: { threadId: thread.id } });
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className="text-xl font-semibold">{t("portal.title")}</h1>

      {customerLinks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("portal.linkTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex items-end gap-2" onSubmit={handleLink}>
              <Field
                label={t("onboarding.portalCode")}
                hint={t("portal.linkHelp")}
                className="flex-1"
              >
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  required
                />
              </Field>
              <Button type="submit">{t("portal.link")}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {next && nextPlace.data?.property ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("portal.next")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="flex items-center gap-2">
                  <Home className="size-4 text-muted-foreground" />
                  {formatAddress(
                    nextPlace.data.property.address_line1,
                    nextPlace.data.property.city,
                  )}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {next.status === "on_my_way"
                    ? t("portal.teamOnTheWay")
                    : next.status === "in_progress"
                      ? t("portal.teamArrived")
                      : next.status === "completed"
                        ? t("portal.done")
                        : t("status.scheduled")}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "upcoming", label: t("schedule.upcoming") },
              { value: "past", label: t("portal.history") },
            ]}
          />

          {visits.isLoading ? (
            <LoadingBlock />
          ) : (visits.data?.length ?? 0) === 0 ? (
            <EmptyState icon={CalendarDays} title={t("portal.empty")} />
          ) : (
            <div className="flex flex-col gap-2">
              {visits.data?.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </div>
          )}

          <Button variant="outline" onClick={handleChat} disabled={ensureThread.isPending}>
            <MessageCircle className="size-4" />
            {t("messages.title")}
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * O cliente não carrega o cadastro da empresa: cada visita busca a própria casa
 * e o preço só aparece se a empresa deixar.
 */
function VisitRow({ visit }: { visit: Appointment }) {
  const place = useJobPlace(visit.customer_id, visit.property_id);
  const company = useCompany(visit.company_id);

  return (
    <AppointmentCard
      appointment={visit}
      customerName={place.data?.property?.label ?? ""}
      address={formatAddress(place.data?.property?.address_line1, place.data?.property?.city)}
      teamNames={[]}
      showPrice={company.data?.show_prices_to_customers ?? false}
    />
  );
}
