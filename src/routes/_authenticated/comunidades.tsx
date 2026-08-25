import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { genreName, useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";

export const Route = createFileRoute("/_authenticated/comunidades")({
  head: () => ({
    meta: [
      { title: "Comunidades — Movie Match" },
      {
        name: "description",
        content: "Comunidades por gênero: recomende filmes e séries e vote nas melhores dicas.",
      },
      { property: "og:title", content: "Comunidades — Movie Match" },
      {
        property: "og:description",
        content: "Comunidades por gênero: recomende filmes e séries e vote nas melhores dicas.",
      },
    ],
  }),
  component: Communities,
});

type Genre = { slug: string; name_pt: string; name_en: string; name_es: string };

function Communities() {
  const { t, lang } = useI18n();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const [{ data: gs }, { data: posts }] = await Promise.all([
        supabase.from("genres").select("slug,name_pt,name_en,name_es").order("sort"),
        supabase.from("posts").select("genre_slug"),
      ]);
      setGenres(gs ?? []);
      const c: Record<string, number> = {};
      (posts ?? []).forEach((p) => {
        c[p.genre_slug] = (c[p.genre_slug] ?? 0) + 1;
      });
      setCounts(c);
    })();
  }, []);

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">{t("communities")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {genres.map((g) => (
          <Link
            key={g.slug}
            to="/comunidades/$slug"
            params={{ slug: g.slug }}
            className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/60"
          >
            <Users className="mb-2 size-5 text-primary" />
            <p className="font-display text-2xl leading-none">{genreName(g, lang)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{counts[g.slug] ?? 0} posts</p>
          </Link>
        ))}
      </div>
      <AdSlot />
    </AppShell>
  );
}
