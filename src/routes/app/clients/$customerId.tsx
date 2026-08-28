import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import {
  useCustomerSeries,
  useDeleteCustomer,
  useDeleteProperty,
  useSaveProperty,
  useUpdateCustomer,
} from "@/features/customers/api";
import { PropertyFields } from "@/features/customers/PropertyFields";
import {
  EMPTY_PROPERTY,
  toPropertyRow,
  type PropertyDraft,
} from "@/features/customers/property-draft";
import { useEnsureThread } from "@/features/messaging/api";
import { formatMoney, formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/clients/$customerId")({ component: ClientDetail });

function ClientDetail() {
  const { customerId } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { company, isManager } = useSession();

  const directory = useDirectory(company?.id);
  const series = useCustomerSeries(customerId);
  const updateCustomer = useUpdateCustomer(company?.id);
  const deleteCustomer = useDeleteCustomer(company?.id);
  const saveProperty = useSaveProperty(company?.id);
  const deleteProperty = useDeleteProperty(company?.id);
  const ensureThread = useEnsureThread();

  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>(EMPTY_PROPERTY);
  const [propertyOpen, setPropertyOpen] = useState(false);

  if (directory.isLoading) return <LoadingBlock />;

  const customer = directory.data?.customerById.get(customerId);
  if (!customer) return <EmptyState title={t("customers.empty")} />;

  const properties = directory.data?.propertiesByCustomer.get(customerId) ?? [];

  async function handleChat() {
    if (!company) return;
    const thread = await ensureThread.mutateAsync({ companyId: company.id, customerId });
    await navigate({ to: "/app/messages/$threadId", params: { threadId: thread.id } });
  }

  async function handleAddProperty(event: React.FormEvent) {
    event.preventDefault();
    await saveProperty.mutateAsync({ ...toPropertyRow(propertyDraft), customer_id: customerId });
    setPropertyDraft(EMPTY_PROPERTY);
    setPropertyOpen(false);
    toast.success(t("common.saved"));
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        <Button variant="outline" size="sm" onClick={handleChat} disabled={ensureThread.isPending}>
          <MessageCircle className="size-4" />
        </Button>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Field label={t("customers.name")}>
            <Input
              defaultValue={customer.name}
              onBlur={(event) =>
                updateCustomer.mutate({ id: customerId, patch: { name: event.target.value } })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("customers.phone")}>
              <Input
                type="tel"
                defaultValue={customer.phone ?? ""}
                onBlur={(event) =>
                  updateCustomer.mutate({
                    id: customerId,
                    patch: { phone: event.target.value || null },
                  })
                }
              />
            </Field>
            <Field label={t("customers.email")}>
              <Input
                type="email"
                defaultValue={customer.email ?? ""}
                onBlur={(event) =>
                  updateCustomer.mutate({
                    id: customerId,
                    patch: { email: event.target.value || null },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t("common.notes")}>
            <Textarea
              defaultValue={customer.notes ?? ""}
              onBlur={(event) =>
                updateCustomer.mutate({
                  id: customerId,
                  patch: { notes: event.target.value || null },
                })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("customers.portalAccess")}</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.account_id ? (
            <Badge tone="success">{t("customers.portalLinked")}</Badge>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("customers.portalInvite")}</p>
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-muted px-3 py-2 text-lg font-semibold tracking-widest">
                  {customer.portal_code}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(customer.portal_code ?? "");
                    toast.success(t("common.copied"));
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("customers.properties")}</CardTitle>
          <Dialog open={propertyOpen} onOpenChange={setPropertyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                {t("customers.addProperty")}
              </Button>
            </DialogTrigger>
            <DialogContent title={t("property.new")}>
              <form className="flex flex-col gap-4" onSubmit={handleAddProperty}>
                <PropertyFields value={propertyDraft} onChange={setPropertyDraft} />
                <Button type="submit" block disabled={saveProperty.isPending}>
                  {t("common.save")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("property.empty")}</p>
          ) : (
            properties.map((property) => (
              <div
                key={property.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{property.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {property.address_line1}
                    {property.city ? `, ${property.city}` : ""}
                  </p>
                  {property.access_notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{property.access_notes}</p>
                  ) : null}
                </div>
                {isManager ? (
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteProperty.mutate(property.id)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("customers.plans")}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/schedule/new">
              <Plus className="size-4" />
              {t("customers.addPlan")}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(series.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.none")}</p>
          ) : (
            series.data?.map((plan) => (
              <div key={plan.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t(`recurrence.${plan.recurrence}`)}</span>
                  <span className="font-semibold">{formatMoney(plan.price, locale)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`service.${plan.service_type}`)} · {formatTime(plan.start_time, locale)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {isManager ? (
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={async () => {
            if (!window.confirm(t("customers.deleteConfirm"))) return;
            await deleteCustomer.mutateAsync(customerId);
            await navigate({ to: "/app/clients" });
          }}
        >
          <Trash2 className="size-4" />
          {t("common.delete")}
        </Button>
      ) : null}
    </div>
  );
}
