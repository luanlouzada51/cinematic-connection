import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Car, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Stars } from "@/components/ui/stars";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import {
  useAvailability,
  useCompanyGigs,
  useHireWorker,
  useWorkerProfile,
  useWorkerReviews,
} from "@/features/marketplace/api";
import { SkillTags } from "@/features/marketplace/components";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatMoney, formatTimestamp, toDateOnly } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/market/workers/$workerId")({
  component: WorkerProfilePage,
});

function WorkerProfilePage() {
  const { workerId } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { company, isManager } = useSession();

  const profile = useWorkerProfile(workerId);
  const availability = useAvailability(workerId);
  const reviews = useWorkerReviews(workerId);
  const gigs = useCompanyGigs(company?.id);
  const hireWorker = useHireWorker();

  const [gigId, setGigId] = useState("");

  const account = useQuery({
    queryKey: ["account", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, full_name, avatar_url, city, state")
        .eq("id", workerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (profile.isLoading || account.isLoading) return <LoadingBlock />;
  if (!profile.data || !account.data) return <EmptyState title={t("market.noWorkers")} />;

  const today = toDateOnly(new Date());
  const openGigs = (gigs.data ?? []).filter(
    (gig) => gig.status === "open" || gig.status === "filled",
  );
  const freeDays = (availability.data ?? []).filter((slot) => slot.date >= today);

  async function handleHire() {
    const gig = openGigs.find((item) => item.id === gigId);
    if (!gig) return;
    try {
      await hireWorker.mutateAsync({ workerId, gig });
      toast.success(t("gig.hire"));
      await navigate({ to: "/app/market/gigs/$gigId", params: { gigId: gig.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.save"));
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-start gap-3">
        <Avatar
          name={account.data.full_name}
          url={account.data.avatar_url}
          className="size-16 text-base"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{account.data.full_name}</h1>
          {profile.data.headline ? (
            <p className="text-sm text-muted-foreground">{profile.data.headline}</p>
          ) : null}
          <div className="mt-1 flex items-center gap-2">
            <Stars value={profile.data.rating_avg} />
            <span className="text-xs text-muted-foreground">
              {profile.data.rating_count > 0
                ? `${profile.data.rating_avg.toFixed(1)} (${profile.data.rating_count})`
                : t("worker.noReviews")}
            </span>
          </div>
          {account.data.city ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {account.data.city}
              {account.data.state ? `, ${account.data.state}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      {profile.data.bio ? (
        <Card>
          <CardContent className="whitespace-pre-wrap pt-4 text-sm">{profile.data.bio}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("worker.skills")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SkillTags skills={profile.data.skills} />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {profile.data.has_car ? (
              <span className="flex items-center gap-1">
                <Car className="size-3.5" />
                {t("worker.hasCar")}
              </span>
            ) : null}
            {profile.data.daily_rate ? (
              <span>
                {t("gig.dailyRate")}: {formatMoney(profile.data.daily_rate, locale)}
              </span>
            ) : null}
            {profile.data.hourly_rate ? (
              <span>
                {t("gig.hourlyRate")}: {formatMoney(profile.data.hourly_rate, locale)}
              </span>
            ) : null}
            {profile.data.accepts_percentage && profile.data.min_percentage ? (
              <span>
                {t("worker.minPercentage")}: {profile.data.min_percentage}%
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("worker.availability")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {freeDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("worker.noAvailability")}</p>
          ) : (
            freeDays.map((slot) => (
              <Badge key={slot.id} tone="primary">
                {formatDate(slot.date, locale)} · {t(`period.${slot.period}`)}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      {company && isManager ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("gig.hire")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <Select value={gigId} onChange={(event) => setGigId(event.target.value)}>
              <option value="">{t("market.myGigs")}</option>
              {openGigs.map((gig) => (
                <option key={gig.id} value={gig.id}>
                  {formatDate(gig.date, locale)} — {gig.title}
                </option>
              ))}
            </Select>
            <Button onClick={handleHire} disabled={!gigId || hireWorker.isPending}>
              {t("gig.hire")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("review.history")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(reviews.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("worker.noReviews")}</p>
          ) : (
            reviews.data?.map((review) => (
              <div key={review.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Stars value={review.rating} />
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(review.created_at, locale)}
                  </span>
                </div>
                {review.comment ? <p className="mt-1.5 text-sm">{review.comment}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
