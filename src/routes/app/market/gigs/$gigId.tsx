import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, MapPin, MessageCircle, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useCompany } from "@/features/company/api";
import { useEnsureThread } from "@/features/messaging/api";
import {
  useApplications,
  useApplyToGig,
  useGig,
  useGigReviews,
  useGigWorkers,
  useHireWorker,
  useUpdateApplication,
  useUpdateGig,
  useUpdateGigWorker,
  useWorkerCards,
} from "@/features/marketplace/api";
import { PayLabel, SkillTags } from "@/features/marketplace/components";
import { ReviewDialog } from "@/features/marketplace/ReviewDialog";
import { formatDate, formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/market/gigs/$gigId")({ component: GigDetail });

function GigDetail() {
  const { gigId } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user, company, isManager } = useSession();

  const gig = useGig(gigId);
  const gigCompany = useCompany(gig.data?.company_id);
  const applications = useApplications(gigId);
  const gigWorkers = useGigWorkers(gigId);
  const reviews = useGigReviews(gigId);

  const applyToGig = useApplyToGig();
  const updateApplication = useUpdateApplication(gigId);
  const hireWorker = useHireWorker();
  const updateGigWorker = useUpdateGigWorker(gigId);
  const updateGig = useUpdateGig(gigId);
  const ensureThread = useEnsureThread();

  const [message, setMessage] = useState("");

  const peopleIds = [
    ...(applications.data ?? []).map((application) => application.worker_id),
    ...(gigWorkers.data ?? []).map((worker) => worker.worker_id),
  ];
  const people = useWorkerCards(peopleIds);

  if (gig.isLoading) return <LoadingBlock />;
  if (!gig.data) return <EmptyState title={t("gig.notFound")} />;

  const job = gig.data;
  const isOwnerCompany = Boolean(company && company.id === job.company_id && isManager);
  const myApplication = (applications.data ?? []).find(
    (application) => application.worker_id === user?.id,
  );
  const myBond = (gigWorkers.data ?? []).find((worker) => worker.worker_id === user?.id);
  const myReviewDone = (reviews.data ?? []).some((review) => review.author_id === user?.id);

  async function openThread(workerId: string) {
    const thread = await ensureThread.mutateAsync({
      companyId: job.company_id,
      gigId,
      workerId,
    });
    await navigate({ to: "/app/messages/$threadId", params: { threadId: thread.id } });
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <Badge tone={job.status === "open" ? "success" : "neutral"}>
            {t(`gigStatus.${job.status}`)}
          </Badge>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          {formatDate(job.date, locale)} · {formatTime(job.start_time, locale)}
          {job.end_time ? ` – ${formatTime(job.end_time, locale)}` : null}
        </p>
        {job.city ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {job.city}
            {job.state ? `, ${job.state}` : ""}
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" />
          {job.headcount} · <PayLabel gig={job} />
        </p>
        {gigCompany.data ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("gig.postedBy")} {gigCompany.data.name}
          </p>
        ) : null}
      </header>

      {job.required_skills.length > 0 ? <SkillTags skills={job.required_skills} /> : null}

      {job.description ? (
        <Card>
          <CardContent className="whitespace-pre-wrap pt-4 text-sm">{job.description}</CardContent>
        </Card>
      ) : null}

      {/* Lado do profissional */}
      {!isOwnerCompany && user ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {myBond ? (
              <>
                <div className="flex items-center justify-between">
                  <Badge tone="info">{t(`gigWorkerStatus.${myBond.status}`)}</Badge>
                  <span className="text-xs text-muted-foreground">{t("gig.bond")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {myBond.status === "hired" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        updateGigWorker.mutate({ id: myBond.id, status: "in_progress" })
                      }
                    >
                      {t("gig.start")}
                    </Button>
                  ) : null}
                  {myBond.status === "in_progress" ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => updateGigWorker.mutate({ id: myBond.id, status: "completed" })}
                    >
                      {t("gig.finish")}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => openThread(user.id)}>
                    <MessageCircle className="size-4" />
                    {t("gig.contact")}
                  </Button>
                  {myBond.status === "completed" ? (
                    <ReviewDialog
                      gigId={gigId}
                      authorId={user.id}
                      subjectKind="company"
                      subjectCompanyId={job.company_id}
                      disabled={myReviewDone}
                    />
                  ) : null}
                </div>
              </>
            ) : myApplication ? (
              <div className="flex items-center justify-between">
                <Badge tone="warning">{t("gig.applied")}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateApplication.mutate({ id: myApplication.id, status: "withdrawn" })
                  }
                >
                  {t("gig.withdraw")}
                </Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    await applyToGig.mutateAsync({ gigId, workerId: user.id, message });
                    setMessage("");
                    toast.success(t("gig.applied"));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : t("error.save"));
                  }
                }}
              >
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("messages.placeholder")}
                />
                <Button type="submit" block disabled={applyToGig.isPending}>
                  {t("gig.apply")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Lado da empresa */}
      {isOwnerCompany ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("gig.applicants")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(applications.data ?? []).filter((a) => a.status === "pending").length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("gig.noApplicants")}</p>
              ) : (
                applications.data
                  ?.filter((application) => application.status === "pending")
                  .map((application) => {
                    const account = people.data?.accounts.get(application.worker_id);
                    return (
                      <div key={application.id} className="flex items-start gap-3">
                        <Avatar name={account?.full_name ?? "?"} url={account?.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/app/market/workers/$workerId"
                            params={{ workerId: application.worker_id }}
                            className="text-sm font-medium underline"
                          >
                            {account?.full_name ?? "—"}
                          </Link>
                          {application.message ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {application.message}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          onClick={async () => {
                            await hireWorker.mutateAsync({
                              workerId: application.worker_id,
                              gig: job,
                            });
                            await updateApplication.mutateAsync({
                              id: application.id,
                              status: "accepted",
                            });
                          }}
                        >
                          {t("gig.hire")}
                        </Button>
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("gig.hiredWorkers")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(gigWorkers.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.none")}</p>
              ) : (
                gigWorkers.data?.map((bond) => {
                  const account = people.data?.accounts.get(bond.worker_id);
                  const rated = (reviews.data ?? []).some(
                    (review) =>
                      review.author_id === user?.id && review.subject_account_id === bond.worker_id,
                  );

                  return (
                    <div
                      key={bond.id}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={account?.full_name ?? "?"} url={account?.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{account?.full_name}</p>
                          <Badge tone="neutral">{t(`gigWorkerStatus.${bond.status}`)}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bond.status === "hired" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateGigWorker.mutate({ id: bond.id, status: "in_progress" })
                            }
                          >
                            {t("gig.start")}
                          </Button>
                        ) : null}
                        {bond.status === "in_progress" ? (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() =>
                              updateGigWorker.mutate({ id: bond.id, status: "completed" })
                            }
                          >
                            {t("gig.finish")}
                          </Button>
                        ) : null}
                        {bond.status === "hired" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateGigWorker.mutate({ id: bond.id, status: "no_show" })
                            }
                          >
                            {t("gig.markNoShow")}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openThread(bond.worker_id)}
                        >
                          <MessageCircle className="size-4" />
                        </Button>
                        {bond.status === "completed" && user ? (
                          <ReviewDialog
                            gigId={gigId}
                            authorId={user.id}
                            subjectKind="worker"
                            subjectAccountId={bond.worker_id}
                            disabled={rated}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {job.status !== "canceled" && job.status !== "completed" ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => updateGig.mutate({ status: "canceled" })}
            >
              {t("gig.cancel")}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
