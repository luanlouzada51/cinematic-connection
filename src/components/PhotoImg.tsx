import { usePhotoUrl } from "@/lib/photos";
import { Poster } from "@/components/Poster";

export function PhotoImg({
  path,
  alt,
  className,
}: {
  path?: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = usePhotoUrl(path);
  return <Poster url={url} alt={alt} className={className ?? ""} />;
}
