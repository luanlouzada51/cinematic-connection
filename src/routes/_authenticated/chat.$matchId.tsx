import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Ban, Flag, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendModeratedMessage } from "@/lib/moderation.functions";
import { botReply } from "@/lib/bots.functions";
import { moderateText } from "@/lib/moderation";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({
    meta: [
      { title: "Conversa — Movie Match" },
      { name: "description", content: "Chat moderado entre matches do Movie Match." },
      { property: "og:title", content: "Conversa — Movie Match" },
      { property: "og:description", content: "Chat moderado entre matches do Movie Match." },
    ],
  }),
  component: Chat,
});

type Msg = { id: string; body: string; sender_id: string; created_at: string };

function Chat() {
  const { matchId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [other, setOther] = useState<{
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_bot?: boolean;
  } | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("user_a,user_b")
        .eq("id", matchId)
        .maybeSingle();
      if (match) {
        const otherId = match.user_a === user.id ? match.user_b : match.user_a;
        const { data: p } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url,is_bot,photos")
          .eq("id", otherId)
          .maybeSingle();
        setOther(p ?? null);
      }
      const { data } = await supabase
        .from("messages")
        .select("id,body,sender_id,created_at")
        .eq("match_id", matchId)
        .order("created_at");
      setMsgs(data ?? []);
    })();

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => setMsgs((m) => [...m, payload.new as Msg]),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const local = moderateText(body, lang);
    if (!local.ok) {
      toast.error(local.message);
      return;
    }
    setBusy(true);
    try {
      const res = await sendModeratedMessage({ data: { matchId, body, lang } });
      if (!res.ok) {
        toast.error(res.message);
      } else {
        setText("");
        if (other?.is_bot) {
          setTyping(true);
          window.setTimeout(() => {
            void botReply({ data: { matchId } })
              .catch(() => undefined)
              .finally(() => setTyping(false));
          }, 900 + Math.random() * 1400);
        }
      }
    } catch {
      toast.error(t("blockedMessage"));
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!user || !other) return;
    await supabase
      .from("reports")
      .insert({ reporter_id: user.id, target_id: other.id, reason: "chat", context: matchId });
    toast.success("Denúncia enviada");
  }

  async function block() {
    if (!user || !other) return;
    await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: other.id });
    toast.success(t("block"));
    void navigate({ to: "/chats" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button size="icon" variant="ghost" onClick={() => void navigate({ to: "/chats" })}>
          <ArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-9">
          <AvatarImage src={other?.avatar_url ?? undefined} />
          <AvatarFallback>{other?.display_name?.slice(0, 2) ?? "?"}</AvatarFallback>
        </Avatar>
        <p className="flex-1 truncate font-semibold">{other?.display_name}</p>
        <Button size="icon" variant="ghost" onClick={() => void report()} aria-label={t("report")}>
          <Flag className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => void block()} aria-label={t("block")}>
          <Ban className="size-4 text-destructive" />
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 py-4">
        <p className="mx-auto flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
          <ShieldAlert className="size-3" /> Chat moderado — contatos e ofensas são bloqueados
        </p>
        {msgs.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
              m.sender_id === user?.id
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-card text-card-foreground",
            )}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => void send(e)}
        className="sticky bottom-0 mx-auto flex w-full max-w-2xl gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("typeMessage")}
        />
        <Button type="submit" size="icon" disabled={busy}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
