import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  botOpeningPrompt,
  botReplyPrompt,
  callPersona,
  humanDelayMs,
  type BotSelf,
} from "./bots.server-helpers";

const BOT_FIELDS = "id,display_name,bot_persona,is_bot,taste_vector,favorite_genres,age,city,bio";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Divide um texto de duas frases em duas mensagens, como gente faz às vezes. */
function splitHuman(text: string): string[] {
  const parts = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (parts.length === 2 && text.length > 60 && Math.random() < 0.45) return parts;
  return [text];
}

/** O agente reage a uma curtida recebida: curte de volta e puxa assunto. */
export const botReactToSwipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { targetId: string }) => {
    if (!data?.targetId) throw new Error("Invalid input");
    return { targetId: data.targetId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bot } = await supabaseAdmin
      .from("profiles")
      .select(BOT_FIELDS)
      .eq("id", data.targetId)
      .maybeSingle();
    if (!bot?.is_bot) return { matched: false as const };

    await supabaseAdmin
      .from("person_swipes")
      .upsert(
        { swiper_id: bot.id, target_id: context.userId, liked: true, super_like: false },
        { onConflict: "swiper_id,target_id" },
      );

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id")
      .or(
        `and(user_a.eq.${context.userId},user_b.eq.${bot.id}),and(user_a.eq.${bot.id},user_b.eq.${context.userId})`,
      )
      .maybeSingle();
    if (!match) return { matched: false as const };

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("display_name,favorite_genres,city")
      .eq("id", context.userId)
      .maybeSingle();

    const { count } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("match_id", match.id);
    if (!count) {
      const text = await callPersona(botOpeningPrompt(bot as BotSelf, me));
      if (text) {
        await supabaseAdmin
          .from("messages")
          .insert({ match_id: match.id, sender_id: bot.id, body: text });
      }
    }
    return { matched: true as const, matchId: match.id };
  });

/** Resposta do agente dentro de uma conversa existente. */
export const botReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { matchId: string }) => {
    if (!data?.matchId) throw new Error("Invalid input");
    return { matchId: data.matchId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id,user_a,user_b")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) return { ok: false as const };
    if (match.user_a !== context.userId && match.user_b !== context.userId)
      return { ok: false as const };
    const botId = match.user_a === context.userId ? match.user_b : match.user_a;

    const { data: bot } = await supabaseAdmin
      .from("profiles")
      .select(BOT_FIELDS)
      .eq("id", botId)
      .maybeSingle();
    if (!bot?.is_bot) return { ok: false as const };

    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("body,sender_id,created_at")
      .eq("match_id", match.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const ordered = (history ?? []).slice().reverse();
    const lastIncoming = [...ordered].reverse().find((m) => m.sender_id !== bot.id)?.body ?? "";
    const text = await callPersona(
      botReplyPrompt(
        bot as BotSelf,
        ordered.map((m) => ({ mine: m.sender_id === bot.id, body: m.body })),
      ),
    );
    if (!text) return { ok: false as const };

    const chunks = splitHuman(text);
    for (const [i, chunk] of chunks.entries()) {
      const wait = Math.min(
        9000,
        i === 0 ? humanDelayMs(lastIncoming.length, chunk.length) : 900 + chunk.length * 35,
      );
      await sleep(wait);
      await supabaseAdmin
        .from("messages")
        .insert({ match_id: match.id, sender_id: bot.id, body: chunk });
    }
    return { ok: true as const };
  });
