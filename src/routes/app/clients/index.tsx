import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useDirectory } from "@/features/company/directory";
import { formatAddress } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/clients/")({ component: ClientsPage });

function ClientsPage() {
  const { t } = useI18n();
  const { company } = useSession();
  const directory = useDirectory(company?.id);
  const [term, setTerm] = useState("");

  const results = useMemo(() => {
    const customers = directory.data?.customers ?? [];
    const needle = term.trim().toLowerCase();
    if (!needle) return customers;

    return customers.filter((customer) => {
      const properties = directory.data?.propertiesByCustomer.get(customer.id) ?? [];
      const haystack = [
        customer.name,
        customer.phone ?? "",
        customer.email ?? "",
        ...properties.map((property) => `${property.address_line1} ${property.city ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [directory.data, term]);

  if (!company) return <EmptyState icon={Users} title={t("error.noCompany")} />;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("customers.title")}</h1>
        <Button asChild size="sm">
          <Link to="/app/clients/new">
            <Plus className="size-4" />
            {t("customers.new")}
          </Link>
        </Button>
      </header>

      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t("customers.searchPlaceholder")}
      />

      {directory.isLoading ? (
        <LoadingBlock />
      ) : results.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("customers.empty")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/app/clients/new">{t("customers.new")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((customer) => {
            const properties = directory.data?.propertiesByCustomer.get(customer.id) ?? [];
            return (
              <li key={customer.id}>
                <Link
                  to="/app/clients/$customerId"
                  params={{ customerId: customer.id }}
                  className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40"
                >
                  <p className="text-sm font-semibold">{customer.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatAddress(properties[0]?.address_line1, properties[0]?.city)}
                  </p>
                  {customer.phone ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{customer.phone}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
