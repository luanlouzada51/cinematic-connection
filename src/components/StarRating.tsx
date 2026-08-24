import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={`${n}`}
          onClick={() => onChange?.(n)}
          className={cn("transition-transform", onChange && "hover:scale-115 active:scale-95")}
        >
          <Star
            className={cn(
              size === "sm" ? "size-4" : "size-7",
              n <= value ? "fill-gold text-gold" : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}
