import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "photos";
const cache = new Map<string, string>();

/** Aceita URL externa (http) ou caminho no armazenamento privado e devolve uma URL exibível. */
export async function resolvePhoto(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
  const cached = cache.get(value);
  if (cached) return cached;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) return null;
  cache.set(value, data.signedUrl);
  return data.signedUrl;
}

export function usePhotoUrl(value?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(
    value && /^(https?:|data:|blob:|\/)/.test(value) ? value : null,
  );
  useEffect(() => {
    let active = true;
    void resolvePhoto(value).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return url;
}

export function usePhotoUrls(values: (string | null | undefined)[]): (string | null)[] {
  const key = values.join("|");
  const [urls, setUrls] = useState<(string | null)[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(values.map((v) => resolvePhoto(v))).then((u) => {
      if (active) setUrls(u);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${crypto.randomUUID()}.${ext || "jpg"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export async function deletePhoto(path: string) {
  if (/^https?:/.test(path)) return;
  cache.delete(path);
  await supabase.storage.from(BUCKET).remove([path]);
}
