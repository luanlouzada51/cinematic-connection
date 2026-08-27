import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Heart, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { Poster } from "@/components/Poster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/listas")({
  head: () => ({
    meta: [
      { title: "Listas de filmes — Movie Match" },
      {
        name: "description",
        content: "Crie listas temáticas de filmes e séries e curta as listas da comunidade.",
      },
      { property: "og:title", content: "Listas de filmes — Movie Match" },
      {
        property: "og:description",
        content: "Crie listas temáticas de filmes e séries e curta as listas da comunidade.",
      },
    ],
  }),
  component: Lists,
});

type TitleLite = { id: string; title: string; poster_url: string | null };
type ListRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  items: TitleLite[];
  likes: number;
};

function Lists() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [lists, setLists] = useState<ListRow[]>([]);
  const [titles, setTitles] = useState<TitleLite[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [liked, setLiked] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [{ data: ls }, { data: items }, { data: ts }, { data: likes }] = await Promise.all([
      supabase.from("lists").select("id,name,description,owner_id,likes_count").order("created_at", {
        ascending: false,
      }),
      supabase.from("list_items").select("list_id,title_id"),
      supabase.from("titles").select("id,title,poster_url").order("title"),
      supabase.from("list_likes").select("list_id,user_id"),
    ]);
    const tmap = Object.fromEntries((ts ?? []).map((x) => [x.id, x]));
    setTitles(ts ?? []);
    setLists(
      (ls ?? []).map((l) => ({
        ...l,
        items: (items ?? [])
          .filter((i) => i.list_id === l.id)
          .map((i) => tmap[i.title_id])
          .filter(Boolean) as TitleLite[],
        likes: l.likes_count ?? 0,
      })),
    );
    setLiked((likes ?? []).filter((x) => x.user_id === user?.id).map((x) => x.list_id));
  }, [user?.id]);


  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!user || !name.trim()) return;
    const { error } = await supabase
      .from("lists")
      .insert({ owner_id: user.id, name: name.trim(), description: desc.trim() || null });
    if (error) { toast.error(error.message); return; }
    setName("");
    setDesc("");
    await load();
  }

  async function addTitle(listId: string, titleId: string) {
    const { error } = await supabase.from("list_items").insert({ list_id: listId, title_id: titleId });
    if (error) { toast.error(error.message); return; }
    await load();
  }

  async function remove(listId: string) {
    await supabase.from("lists").delete().eq("id", listId);
    await load();
  }

  async function like(listId: string) {
    if (!user) return;
    if (liked.includes(listId)) {
      await supabase.from("list_likes").delete().eq("list_id", listId).eq("user_id", user.id);
    } else {
      await supabase.from("list_likes").insert({ list_id: listId, user_id: user.id });
    }
    await load();
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">{t("lists")}</h1>

      <div className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-xl">{t("newList")}</p>
        <Input placeholder={t("listName")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder={t("listDesc")} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={() => void create()}>
          <Plus className="size-4" /> {t("newList")}
        </Button>
      </div>

      <ul className="space-y-3">
        {lists.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            {t("empty")}
          </li>
        )}
        {lists.map((l) => (
          <li key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-2xl leading-tight">{l.name}</h2>
                {l.description && (
                  <p className="text-sm text-muted-foreground">{l.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => void like(l.id)}>
                  <Heart
                    className={liked.includes(l.id) ? "size-4 fill-primary text-primary" : "size-4"}
                  />
                  {l.likes}
                </Button>
                {l.owner_id === user?.id && (
                  <Button size="icon" variant="ghost" onClick={() => void remove(l.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            {l.items.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {l.items.map((it) => (
                  <div key={it.id} className="w-20 shrink-0">
                    <Poster
                      url={it.poster_url}
                      alt={it.title}
                      className="aspect-2/3 w-full rounded-lg"
                    />
                    <p className="truncate text-[10px]">{it.title}</p>
                  </div>
                ))}
              </div>
            )}

            {l.owner_id === user?.id && (
              <div className="mt-3">
                <Select onValueChange={(v) => void addTitle(l.id, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("addTitle")} />
                  </SelectTrigger>
                  <SelectContent>
                    {titles.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </li>
        ))}
      </ul>

      <AdSlot />
    </AppShell>
  );
}
