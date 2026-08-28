import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary/10 text-primary",
        info: "bg-info/10 text-info",
        success: "bg-success/15 text-success",
        warning: "bg-warning/20 text-warning-foreground",
        danger: "bg-destructive/10 text-destructive",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
