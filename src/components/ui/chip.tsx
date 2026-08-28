import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type ChipProps = {
  label: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
};

/** Etiqueta que liga/desliga — usada para habilidades e filtros. */
export function Chip({ label, selected, onToggle, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40",
        className,
      )}
    >
      {selected ? <Check className="size-3" /> : null}
      {label}
    </button>
  );
}
