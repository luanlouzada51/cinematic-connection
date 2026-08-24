import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

export function Poster({
  url,
  alt,
  className,
}: {
  url?: string | null;
  alt: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-muted-foreground",
          className,
        )}
      >
        <Film className="size-8" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("object-cover", className)}
    />
  );
}
