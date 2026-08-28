import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import {
  useCompanyGigs,
  useGigsByIds,
  useMyApplications,
  useOpenGigs,
  useWorkerSearch,
} from "@/features/marketplace/api";
import { GigCard, SkillPicker, WorkerCard } from "@/features/marketplace/components";
import type { CleaningSkill } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/market/")({ component: MarketPage });

type CompanyTab = "workers" | "gigs";
type WorkerTab = "gigs" | "applications";

function MarketPage() {
  const { t } = useI18n();
  const { account, company, isManager } = useSession();

  // A parte de mercado não existe para quem entrou como cliente.
  if (account?.primary_role === "customer") {
    return <EmptyState icon={Lock} title={t("market.blockedForCustomers")} />;
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("market.title")}</h1>
        {company && isManager ? (
          <Button asChild size="sm">
            <Link to="/app/market/gigs/new">
              <Plus className="size-4" />
              {t("market.postGig")}
            </Link>
          </Button>
        ) : null}
      </header>

      {company && isManager ? <CompanyMarket /> : <WorkerMarket />}
    </div>
  );
}

function CompanyMarket() {
  const { t } = useI18n();
  const { company } = useSession();
  const [tab, setTab] = useState<CompanyTab>("workers");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<CleaningSkill[]>([]);

  const workers = useWorkerSearch({ date, city, skills });
  const gigs = useCompanyGigs(company?.id);

  return (
    <>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "workers", label: t("market.findWorkers") },
          { value: "gigs", label: t("market.myGigs") },
        ]}
      />

      {tab === "workers" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label={t("market.filterDate")}
            />
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("market.filterCity")}
            />
          </div>
          <SkillPicker selected={skills} onChange={setSkills} />

          {workers.isLoading ? (
            <LoadingBlock />
          ) : (workers.data?.length ?? 0) === 0 ? (
            <EmptyState icon={Search} title={t("market.noWorkers")} />
          ) : (
            <div className="flex flex-col gap-2">
              {workers.data?.map((row) => (
                <WorkerCard
                  key={row.profile.account_id}
                  account={row.account!}
                  profile={row.profile}
                />
              ))}
            </div>
          )}
        </>
      ) : gigs.isLoading ? (
        <LoadingBlock />
      ) : (gigs.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("market.noGigs")} />
      ) : (
        <div className="flex flex-col gap-2">
          {gigs.data?.map((gig) => (
            <GigCard key={gig.id} gig={gig} />
          ))}
        </div>
      )}
    </>
  );
}

function WorkerMarket() {
  const { t } = useI18n();
  const { user } = useSession();
  const [tab, setTab] = useState<WorkerTab>("gigs");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<CleaningSkill[]>([]);

  const gigs = useOpenGigs({ city, date, skills });
  const applications = useMyApplications(user?.id);
  const appliedGigs = useGigsByIds(
    (applications.data ?? []).map((application) => application.gig_id),
  );

  return (
    <>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "gigs", label: t("market.openGigs") },
          { value: "applications", label: t("market.myApplications") },
        ]}
      />

      {tab === "gigs" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label={t("market.filterDate")}
            />
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("market.filterCity")}
            />
          </div>
          <SkillPicker selected={skills} onChange={setSkills} />

          {gigs.isLoading ? (
            <LoadingBlock />
          ) : (gigs.data?.length ?? 0) === 0 ? (
            <EmptyState icon={Search} title={t("market.noGigs")} />
          ) : (
            <div className="flex flex-col gap-2">
              {gigs.data?.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
              ))}
            </div>
          )}
        </>
      ) : applications.isLoading ? (
        <LoadingBlock />
      ) : (appliedGigs.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("market.noGigs")} />
      ) : (
        <div className="flex flex-col gap-2">
          {appliedGigs.data?.map((gig) => (
            <GigCard key={gig.id} gig={gig} />
          ))}
        </div>
      )}
    </>
  );
}
