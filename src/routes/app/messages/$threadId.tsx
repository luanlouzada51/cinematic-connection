import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/features/auth/session";
import { useCompany } from "@/features/company/api";
import { useMessages, useSendMessage, useThread } from "@/features/messaging/api";
import { formatClock } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/messages/$threadId")({ component: Conversation });

function Conversation() {
  const { threadId } = Route.useParams();
  const { t, locale } = useI18n();
  const { user, company } = useSession();

  const thread = useThread(threadId);
  const messages = useMessages(threadId);
  const sendMessage = useSendMessage(threadId);
  const threadCompany = useCompany(thread.data?.company_id);

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  const insideCompany = company?.id === thread.data?.company_id;
  const chatBlocked =
    thread.data?.kind === "customer" &&
    !insideCompany &&
    threadCompany.data?.allow_customer_chat === false;

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !draft.trim()) return;
    await sendMessage.mutateAsync({ body: draft.trim(), senderId: user.id });
    setDraft("");
  }

  if (thread.isLoading || messages.isLoading) return <LoadingBlock />;

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="flex-1 space-y-2 pb-4">
        {messages.data?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("messages.noMessages")}
          </p>
        ) : (
          messages.data?.map((message) => {
            const mine = message.sender_id === user?.id;
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-secondary text-secondary-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {formatClock(message.created_at, locale)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {chatBlocked ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
          {t("messages.customerChatOff")}
        </p>
      ) : (
        <form
          className="sticky bottom-20 flex items-center gap-2 bg-background py-2"
          onSubmit={handleSend}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("messages.placeholder")}
          />
          <Button type="submit" size="icon" disabled={sendMessage.isPending || !draft.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
