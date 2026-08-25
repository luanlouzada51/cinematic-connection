import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, MessageSquare, Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { genreName, useI18n } from "@/lib/i18n";
import { moderateText } from "@/lib/moderation";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comunidades/$slug")({
  head: () => ({
    meta: [
      { title: "Comunidade — Movie Match" },
      { name: "description", content: "Recomendações e debates da comunidade por gênero." },
      { property: "og:title", content: "Comunidade — Movie Match" },
      { property: "og:description", content: "Recomendações e debates da comunidade por gênero." },
    ],
  }),
  component: Community,
});

type Post = {
  id: string;
  title: string;
  body: string;
  kind: string;
  score: number;
  author_id: string;
  created_at: string;
};
type Comment = { id: string; post_id: string; body: string; author_id: string };

function Community() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [genre, setGenre] = useState<{
    slug: string;
    name_pt: string;
    name_en: string;
    name_es: string;
  } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<"movie" | "series">("movie");
  const [form, setForm] = useState({ title: "", body: "" });
  const [commentText, setCommentText] = useState("");

  const load = useCallback(async () => {
    const [{ data: g }, { data: ps }] = await Promise.all([
      supabase
        .from("genres")
        .select("slug,name_pt,name_en,name_es")
        .eq("slug", slug)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("*")
        .eq("genre_slug", slug)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setGenre(g ?? null);
    setPosts((ps ?? []) as Post[]);
    const authorIds = [...new Set((ps ?? []).map((p) => p.author_id))];
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", authorIds);
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name])));
    }
    if (user) {
      const { data: vs } = await supabase.from("votes").select("post_id,value").eq("user_id", user.id);
      setVotes(Object.fromEntries((vs ?? []).map((v) => [v.post_id, v.value])));
    }
  }, [slug, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function vote(postId: string, value: number) {
    if (!user) return;
    const currentVal = votes[postId] ?? 0;
    const next = currentVal === value ? 0 : value;
    setVotes({ ...votes, [postId]: next });
    setPosts((ps) =>
      ps.map((p) => (p.id === postId ? { ...p, score: p.score - currentVal + next } : p)),
    );
    if (next === 0) {
      await supabase.from("votes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase
        .from("votes")
        .upsert({ post_id: postId, user_id: user.id, value: next }, { onConflict: "post_id,user_id" });
    }
  }

  async function publish() {
    if (!user) return;
    if (!form.title.trim()) return;
    const mod = moderateText(`${form.title} ${form.body}`, lang);
    if (!mod.ok) return toast.error(mod.message);
    const { error } = await supabase.from("posts").insert({
      genre_slug: slug,
      kind,
      author_id: user.id,
      title: form.title.trim(),
      body: form.body.trim(),
    });
    if (error) return toast.error(error.message);
    setForm({ title: "", body: "" });
    toast.success(t("publish"));
    await load();
  }

  async function loadComments(postId: string) {
    setOpen(open === postId ? null : postId);
    if (comments[postId]) return;
    const { data } = await supabase
      .from("comments")
      .select("id,post_id,body,author_id")
      .eq("post_id", postId)
      .order("created_at");
    setComments((c) => ({ ...c, [postId]: (data ?? []) as Comment[] }));
  }

  async function addComment(postId: string) {
    if (!user || !commentText.trim()) return;
    const mod = moderateText(commentText, lang);
    if (!mod.ok) return toast.error(mod.message);
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, author_id: user.id, body: commentText.trim() })
      .select("id,post_id,body,author_id")
      .single();
    if (error) return toast.error(error.message);
    setComments((c) => ({ ...c, [postId]: [...(c[postId] ?? []), data as Comment] }));
    setCommentText("");
  }

  async function report(postId: string) {
    if (!user) return;
    await supabase
      .from("reports")
      .insert({ reporter_id: user.id, reason: "post", context: postId });
    toast.success("Denúncia enviada");
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/comunidades">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-3xl">{genre ? genreName(genre, lang) : slug}</h1>
      </div>

      <div className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-xl">{t("newPost")}</p>
        <div className="flex gap-2">
          {(["movie", "series"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                kind === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground",
              )}
            >
              {k === "movie" ? t("movies") : t("series")}
            </button>
          ))}
        </div>
        <Input
          placeholder={t("postTitle")}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Textarea
          rows={3}
          placeholder={t("postBody")}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        <Button onClick={() => void publish()}>{t("publish")}</Button>
      </div>

      <ul className="space-y-3">
        {posts.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            {t("empty")}
          </li>
        )}
        {posts.map((p, i) => (
          <li key={p.id}>
            {i === 3 && <AdSlot index={1} />}
            <article className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={() => void vote(p.id, 1)}
                  aria-label="upvote"
                  className={cn(
                    "rounded p-1 hover:bg-secondary",
                    votes[p.id] === 1 && "text-primary",
                  )}
                >
                  <ChevronUp className="size-5" />
                </button>
                <span className="text-sm font-semibold">{p.score}</span>
                <button
                  onClick={() => void vote(p.id, -1)}
                  aria-label="downvote"
                  className={cn(
                    "rounded p-1 hover:bg-secondary",
                    votes[p.id] === -1 && "text-destructive",
                  )}
                >
                  <ChevronDown className="size-5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {p.kind === "movie" ? t("movies") : t("series")} ·{" "}
                  {names[p.author_id] ?? "anon"}
                </p>
                <h2 className="text-xl leading-tight">{p.title}</h2>
                {p.body && <p className="mt-1 whitespace-pre-wrap text-sm">{p.body}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => void loadComments(p.id)}>
                    <MessageSquare className="size-4" /> {t("comments")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void report(p.id)}>
                    <Flag className="size-4" />
                  </Button>
                </div>

                {open === p.id && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {(comments[p.id] ?? []).map((c) => (
                      <p key={c.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">
                          {names[c.author_id] ?? "anon"}:{" "}
                        </span>
                        {c.body}
                      </p>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={t("comment")}
                      />
                      <Button size="sm" onClick={() => void addComment(p.id)}>
                        {t("send")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
