import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Stars } from "@/components/ui/stars";
import { useSubmitReview } from "@/features/marketplace/api";
import type { ReviewSubject } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";

type Props = {
  gigId: string;
  authorId: string;
  subjectKind: ReviewSubject;
  subjectAccountId?: string;
  subjectCompanyId?: string;
  disabled?: boolean;
};

/** Os dois lados avaliam: fica o histórico de como foi trabalhar junto. */
export function ReviewDialog({
  gigId,
  authorId,
  subjectKind,
  subjectAccountId,
  subjectCompanyId,
  disabled,
}: Props) {
  const { t } = useI18n();
  const submitReview = useSubmitReview(gigId);

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await submitReview.mutateAsync({
        authorId,
        subjectKind,
        subjectAccountId,
        subjectCompanyId,
        rating,
        comment,
      });
      setOpen(false);
      setComment("");
      toast.success(t("review.submitted"));
    } catch {
      toast.error(t("review.alreadyRated"));
    }
  }

  const label = subjectKind === "worker" ? t("review.rateWorker") : t("review.rateCompany");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent title={label}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Stars value={rating} onChange={setRating} size="md" className="justify-center" />
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("review.comment")}
          />
          <Button type="submit" block disabled={submitReview.isPending}>
            {t("review.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
