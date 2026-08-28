import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useSession } from "@/features/auth/session";
import { useCreateCustomer } from "@/features/customers/api";
import { PropertyFields } from "@/features/customers/PropertyFields";
import {
  EMPTY_PROPERTY,
  toPropertyRow,
  type PropertyDraft,
} from "@/features/customers/property-draft";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/clients/new")({ component: NewClientPage });

function NewClientPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { company } = useSession();
  const createCustomer = useCreateCustomer(company?.id);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [property, setProperty] = useState<PropertyDraft>(EMPTY_PROPERTY);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!company) return;

    try {
      const customer = await createCustomer.mutateAsync({
        name,
        email,
        phone,
        notes,
        property: toPropertyRow(property),
      });
      toast.success(t("common.saved"));
      await navigate({ to: "/app/clients/$customerId", params: { customerId: customer.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.save"));
    }
  }

  return (
    <form className="flex flex-col gap-4 pb-8" onSubmit={handleSubmit}>
      <h1 className="text-xl font-semibold">{t("customers.new")}</h1>

      <Field label={t("customers.name")}>
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("customers.phone")}>
          <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label={t("customers.email")}>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      </div>

      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("property.new")}
      </h2>
      <PropertyFields value={property} onChange={setProperty} />

      <Field label={t("common.notes")}>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" block disabled={createCustomer.isPending}>
          {createCustomer.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/clients">{t("common.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
