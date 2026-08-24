import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moderateText } from "./moderation";

type Input = { matchId: string; body: string; lang: "pt" | "en" | "es" };

/**
 * Sends a chat message after server-side moderation:
 * 1. deterministic regex/wordlist check
 * 2. AI toxicity classification through the Lovable AI gateway
 */
export const sendModeratedMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => {
    if (!data || typeof data.body !== "string" || !data.matchId) throw new Error("Invalid input");
    const body = data.body.trim().slice(0, 2000);
    if (!body) throw new Error("Empty message");
    const lang = ["pt", "en", "es"].includes(data.lang) ? data.lang : "pt";
    return { matchId: data.matchId, body, lang: lang as Input["lang"] };
  })
  .handler(async ({ data, context }) => {
    const local = moderateText(data.body, data.lang);
    if (!local.ok) return { ok: false as const, message: local.message };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "You are a chat safety classifier for a movie dating app. Answer with exactly one word: BLOCK if the message contains harassment, hate speech, sexual harassment, threats, slurs, or attempts to move the conversation to another platform / share contact info. Otherwise answer OK.",
              },
              { role: "user", content: data.body },
            ],
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const verdict = json.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "OK";
          if (verdict.startsWith("BLOCK")) {
            return {
              ok: false as const,
              message: {
                pt: "Sua mensagem foi bloqueada pela moderação automática.",
                en: "Your message was blocked by automatic moderation.",
                es: "Tu mensaje fue bloqueado por la moderación automática.",
              }[data.lang],
            };
          }
        }
      } catch (err) {
        console.error("AI moderation unavailable", err);
      }
    }

    const { error } = await context.supabase.from("messages").insert({
      match_id: data.matchId,
      sender_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
