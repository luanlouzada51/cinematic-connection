import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { deletePhoto, uploadPhoto, usePhotoUrls } from "@/lib/photos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MAX_PHOTOS = 5;

export function PhotoUploader({
  userId,
  photos,
  onChange,
}: {
  userId: string;
  photos: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const urls = usePhotoUrls(photos);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(t("maxPhotos"));
      return;
    }
    setBusy(true);
    try {
      const chosen = Array.from(files).slice(0, room);
      const paths: string[] = [];
      for (const f of chosen) {
        if (!f.type.startsWith("image/")) continue;
        paths.push(await uploadPhoto(userId, f));
      }
      onChange([...photos, ...paths]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(path: string) {
    onChange(photos.filter((p) => p !== path));
    await deletePhoto(path);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("photosSub")}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p, i) => (
          <div
            key={p}
            className={cn(
              "relative aspect-square overflow-hidden rounded-xl border",
              i === 0 ? "border-primary" : "border-border",
            )}
          >
            {urls[i] ? (
              <img src={urls[i]!} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full animate-pulse bg-secondary" />
            )}
            <button
              type="button"
              aria-label={t("removePhoto")}
              onClick={() => void remove(p)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-destructive"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 text-muted-foreground hover:border-primary/60"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void pick(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={busy || photos.length >= MAX_PHOTOS}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-4" /> {busy ? t("uploading") : t("addPhoto")}
      </Button>
    </div>
  );
}
