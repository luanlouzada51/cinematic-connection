import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts.at(-1)![0]! : "")).toUpperCase();
}

type AvatarProps = {
  name: string;
  url?: string | null | undefined;
  className?: string | undefined;
};

export function Avatar({ name, url, className }: AvatarProps) {
  const base = cn(
    "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground",
    className,
  );

  if (url) {
    return <img src={url} alt={name} className={cn(base, "object-cover")} />;
  }
  return <span className={base}>{initials(name)}</span>;
}
