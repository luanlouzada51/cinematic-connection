import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Stars } from "@/components/ui/stars";
import { SKILLS } from "@/features/marketplace/constants";
import type { Account, CleaningSkill, Gig, WorkerProfile } from "@/integrations/supabase/types";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function SkillPicker({
  selected,
  onChange,
}: {
  selected: CleaningSkill[];
  onChange: (skills: CleaningSkill[]) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {SKILLS.map((skill) => (
        <Chip
          key={skill}
          label={t(`skill.${skill}`)}
          selected={selected.includes(skill)}
          onToggle={() =>
            onChange(
              selected.includes(skill)
                ? selected.filter((item) => item !== skill)
                : [...selected, skill],
            )
          }
        />
      ))}
    </div>
  );
}

export function SkillTags({ skills }: { skills: CleaningSkill[] }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <Badge key={skill} tone="outline">
          {t(`skill.${skill}`)}
        </Badge>
      ))}
    </div>
  );
}

/** Texto curto do pagamento combinado — aparece na lista e no detalhe da vaga. */
export function PayLabel({ gig }: { gig: Gig }) {
  const { t, locale } = useI18n();

  if (gig.pay_model === "percentage") {
    return <span>{`${gig.worker_percentage ?? 0}% · ${t("payModel.percentage")}`}</span>;
  }
  if (gig.pay_model === "hourly") {
    return <span>{`${formatMoney(gig.hourly_rate ?? 0, locale)} / h`}</span>;
  }
  return <span>{`${formatMoney(gig.daily_rate ?? 0, locale)} · ${t("payModel.daily")}`}</span>;
}

export function GigCard({ gig }: { gig: Gig }) {
  const { t, locale } = useI18n();

  return (
    <Link
      to="/app/market/gigs/$gigId"
      params={{ gigId: gig.id }}
      className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{gig.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {formatDate(gig.date, locale)} · {formatTime(gig.start_time, locale)}
          </p>
          {gig.city ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {gig.city}
              {gig.state ? `, ${gig.state}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={gig.status === "open" ? "success" : "neutral"}>
            {t(`gigStatus.${gig.status}`)}
          </Badge>
          <span className="text-xs font-medium">
            <PayLabel gig={gig} />
          </span>
          {gig.headcount > 1 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              {gig.headcount}
            </span>
          ) : null}
        </div>
      </div>

      {gig.required_skills.length > 0 ? (
        <div className="mt-3">
          <SkillTags skills={gig.required_skills} />
        </div>
      ) : null}
    </Link>
  );
}

type WorkerCardProps = {
  account: Pick<Account, "id" | "full_name" | "avatar_url" | "city" | "state">;
  profile: WorkerProfile;
};

export function WorkerCard({ account, profile }: WorkerCardProps) {
  const { t } = useI18n();

  return (
    <Link
      to="/app/market/workers/$workerId"
      params={{ workerId: account.id }}
      className="flex gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40"
    >
      <Avatar name={account.full_name} url={account.avatar_url} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{account.full_name}</p>
        {profile.headline ? (
          <p className="truncate text-xs text-muted-foreground">{profile.headline}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <Stars value={profile.rating_avg} />
          <span className="text-xs text-muted-foreground">
            {profile.rating_count > 0
              ? `${profile.rating_avg.toFixed(1)} (${profile.rating_count})`
              : t("worker.noReviews")}
          </span>
        </div>
        <div className="mt-2">
          <SkillTags skills={profile.skills.slice(0, 4)} />
        </div>
      </div>
    </Link>
  );
}
