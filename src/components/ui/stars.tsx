import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type StarsProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  className?: string;
};

export function Stars({ value, onChange, size = "sm", className }: StarsProps) {
  const starClass = size === "sm" ? "size-4" : "size-7";

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const icon = (
          <Star
            className={cn(
              starClass,
              filled ? "fill-warning text-warning" : "text-muted-foreground/40",
            )}
          />
        );

        return onChange ? (
          <button
            key={star}
            type="button"
            aria-label={`${star}`}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </div>
  );
}
