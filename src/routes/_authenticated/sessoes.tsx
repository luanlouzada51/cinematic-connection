import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, LogIn, LogOut, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { moderateText } from "@/lib/moderation";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/sessoes")({
  head: () => ({
    meta: [
      { title: "Watch Party — Movie Match" },
      {
        name: "description",
        content: "Marque sessões de cinema com seus matches e converse durante o filme.",
      },
      { property: "og:title", content: "Watch Party — Movie Match" },
      {
        property: "og:description",
        content: "Marque sessões de cinema com seus matches e converse durante o filme.",
      },
    ],
  }),
  component: Parties,
});

type TitleLite = { id: string; title: string; poster_url: string | null };
type Party = {
  id: string;
  host_id: string;
  title_id: string;
  scheduled_at: string;
  note: string | null;
  members: string[];
};
type PMsg = { id: string; body: string; sender_id: string };

function Parties() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [titles, setTitles] = useState<TitleLite[]>([]);
  const [titleId, setTitleId] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [openParty, setOpenParty] = useState<Party | null>(null);
  const [msgs, setMsgs] = useState<PMsg[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const [{ data: ps }, { data: ts }, { data: ms }] = await Promise.all([
      supabase.from("watch_parties").select("*").order("scheduled_at"),
      supabase.from("titles").select("id,title,poster_url").order("title"),
      supabase.from("watch_party_members").select("party_id,user_id"),
    ]);
    setTitles(ts ?? []);
    setParties(
      (ps ?? []).map((p) => ({
        ...p,
        members: (ms ?? []).filter((m) => m.party_id === p.id).map((m) => m.user_id),
      })) as Party[],
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openParty) return;
    void (async () => {
      const { data } = await supabase
        .from("watch_party_messages")
        .select("id,body,sender_id")
        .eq("party_id", openParty.id)
        .order("created_at");
      setMsgs((data ?? []) as PMsg[]);
    })();
    const channel = supabase
      .channel(`party-${openParty.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "watch_party_messages",
          filter: `party_id=eq.${openParty.id}`,
        },
        (payload) => setMsgs((m) => [...m, payload.new as PMsg]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [openParty]);

  async function create() {
    if (!user || !titleId || !when) return toast.error(t("when"));
    const { error } = await supabase.from("watch_parties").insert({
      host_id: user.id,
      title_id: titleId,
      scheduled_at: new Date(when).toISOString(),
      note: note.trim() || null,
    });
    if (error) return toast.error(error.message);
    setTitleId("");
    setWhen("");
    setNote("");
    await load();
  }

  async function join(p: Party) {
    if (!user) return;
    if (p.members.includes(user.id)) {
      await supabase
        .from("watch_party_members")
        .delete()
        .eq("party_id", p.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("watch_party_members").insert({ party_id: p.id, user_id: user.id });
    }
    await load();
  }

  async function send() {
    if (!user || !openParty || !text.trim()) return;
    const mod = moderateText(text, lang);
    if (!mod.ok) return toast.error(mod.message);
    const { error } = await supabase
      .from("watch_party_messages")
      .insert({ party_id: openParty.id, sender_id: user.id, body: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
  }

  const tmap = Object.fromEntries(titles.map((x) => [x.id, x]));

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl">{t("sessions")}</h1>

      <div className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-xl">{t("newSession")}</p>
        <Select value={titleId} onValueChange={setTitleId}>
          <SelectTrigger>
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
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <Input placeholder={t("listDesc")} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={() => void create()}>
          <CalendarClock className="size-4" /> {t("newSession")}
        </Button>
      </div>

      <ul className="space-y-3">
        {parties.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            {t("empty")}
          </li>
        )}
        {parties.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            <Poster
              url={tmap[p.title_id]?.poster_url}
              alt={tmap[p.title_id]?.title ?? ""}
              className="h-24 w-16 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl leading-tight">{tmap[p.title_id]?.title}</h2>
              <p className="text-xs text-muted-foreground">
                {new Date(p.scheduled_at).toLocaleString()} · {p.members.length} {t("participants")}
              </p>
              {p.note && <p className="mt-1 text-sm">{p.note}</p>}
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void join(p)}>
                  {user && p.members.includes(user.id) ? (
                    <>
                      <LogOut className="size-4" /> {t("leave")}
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" /> {t("join")}
                    </>
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpenParty(p)}>
                  <MessageSquare className="size-4" /> {t("sessionChat")}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AdSlot />

      <Dialog open={!!openParty} onOpenChange={(o) => !o && setOpenParty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sessionChat")}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {msgs.map((m) => (
              <p
                key={m.id}
                className={
                  m.sender_id === user?.id
                    ? "self-end rounded-2xl bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    : "self-start rounded-2xl bg-secondary px-3 py-1.5 text-sm"
                }
              >
                {m.body}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("typeMessage")}
            />
            <Button size="icon" onClick={() => void send()}>
              <Send className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
